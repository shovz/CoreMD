from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timedelta, timezone
import random
import uuid
from redis import Redis
from pymongo.database import Database
from bson import ObjectId
from pydantic import BaseModel

from app.core.auth import get_current_user_id
from app.schemas.question import QuestionOut, QuestionFull, Difficulty
from app.schemas.question_attempt import QuestionAttemptCreate, AttemptResult
from app.schemas.exam import (
    StageAExamSessionOut,
    StageAAnswerCreate,
    StageAAnswerResult,
    StageAReportOut,
    StageAStartRequest,
    StageAPreviewOut,
    StageAExamPresetIn,
    StageAExamPresetOut,
)
from app.services.question_attempt_service import record_attempt
from app.db.deps import mongo_db, redis_client


router = APIRouter(prefix="/questions", tags=["questions"])


STAGE_A_QUESTION_COUNT = 150
STAGE_A_DURATION_SECONDS = 4 * 60 * 60
STAGE_A_BLUEPRINT_VERSION = "stage-a-v1"
STAGE_A_BLUEPRINT = {
    "easy": 0.2,
    "medium": 0.5,
    "hard": 0.3,
}

EXAM_PRESET_EXAM_TYPE = "stage-a"


def _doc_to_question_out(doc: dict) -> dict:
    return {
        "question_id": doc["question_id"],
        "stem": doc["stem"],
        "options": doc["options"],
        "topic": doc["topic"],
        "chapter_id": doc.get("chapter_id") or doc.get("chapter_ref"),
        "difficulty": doc["difficulty"],
    }


def _doc_to_question_full(doc: dict) -> dict:
    return {
        **_doc_to_question_out(doc),
        "correct_option": doc["correct_option"],
        "explanation": doc["explanation"],
    }


def _to_utc_datetime(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _remaining_seconds(session_doc: dict) -> int:
    now = datetime.now(timezone.utc)
    expires_at = _to_utc_datetime(session_doc["expires_at"])
    return max(0, int((expires_at - now).total_seconds()))


def _score_stage_a(session_doc: dict) -> dict:
    items = session_doc["items"]
    answered = [item for item in items if item.get("selected_option") is not None]
    answered_count = len(answered)
    correct_count = sum(1 for item in answered if item.get("is_correct") is True)
    percent = round((correct_count / len(items)) * 100, 2) if items else 0.0

    topic_map: dict[str, dict] = {}
    diff_map: dict[str, dict] = {}

    for item in items:
        topic = item["topic"]
        diff = item["difficulty"]

        if topic not in topic_map:
            topic_map[topic] = {"topic": topic, "total": 0, "answered": 0, "correct": 0}
        if diff not in diff_map:
            diff_map[diff] = {"difficulty": diff, "total": 0, "answered": 0, "correct": 0}

        topic_map[topic]["total"] += 1
        diff_map[diff]["total"] += 1
        if item.get("selected_option") is not None:
            topic_map[topic]["answered"] += 1
            diff_map[diff]["answered"] += 1
            if item.get("is_correct"):
                topic_map[topic]["correct"] += 1
                diff_map[diff]["correct"] += 1

    by_topic = sorted(topic_map.values(), key=lambda row: row["topic"])
    by_difficulty = sorted(diff_map.values(), key=lambda row: row["difficulty"])

    return {
        "answered_count": answered_count,
        "correct_count": correct_count,
        "percent_correct": percent,
        "by_topic": by_topic,
        "by_difficulty": by_difficulty,
    }


def _normalized_scope(scope: StageAStartRequest | None) -> dict:
    s = scope or StageAStartRequest()
    return {
        "topics": sorted({t.strip() for t in s.topics if isinstance(t, str) and t.strip()}),
        "part_numbers": sorted({int(p) for p in s.part_numbers}),
        "chapter_ids": sorted({c.strip() for c in s.chapter_ids if isinstance(c, str) and c.strip()}),
        "exclude_answered_correctly": bool(s.exclude_answered_correctly),
    }


def _chapter_part_map(db: Database) -> dict[str, int]:
    docs = db["chapters"].find({}, {"_id": 0, "chapter_id": 1, "part_number": 1})
    result: dict[str, int] = {}
    for doc in docs:
        chapter_id = doc.get("chapter_id")
        part_number = doc.get("part_number")
        if isinstance(chapter_id, str) and isinstance(part_number, int):
            result[chapter_id] = part_number
    return result


def _eligible_stage_a_docs(db: Database, user_id: str, scope: dict) -> list[dict]:
    docs = list(
        db["questions"].find(
            {"is_chain": {"$ne": True}},
            {"_id": 0},
        )
    )
    if not docs:
        return []

    topics = set(scope["topics"])
    chapter_ids = set(scope["chapter_ids"])
    part_numbers = set(scope["part_numbers"])
    chapter_to_part = _chapter_part_map(db) if part_numbers else {}

    filtered: list[dict] = []
    for doc in docs:
        if topics and doc.get("topic") not in topics:
            continue

        chapter_id = doc.get("chapter_id") or doc.get("chapter_ref")
        if chapter_ids and chapter_id not in chapter_ids:
            continue

        if part_numbers:
            part_num = chapter_to_part.get(chapter_id) if isinstance(chapter_id, str) else None
            if part_num not in part_numbers:
                continue

        filtered.append(doc)

    if scope["exclude_answered_correctly"]:
        answered_ids = set(
            db["question_attempts"].distinct(
                "question_id",
                {"user_id": ObjectId(user_id), "is_correct": True},
            )
        )
        filtered = [doc for doc in filtered if doc.get("question_id") not in answered_ids]

    return filtered


def _build_stage_a_items(db: Database, user_id: str, scope: dict) -> tuple[list[dict], int, int, bool]:
    docs = _eligible_stage_a_docs(db, user_id, scope)
    if len(docs) == 0:
        raise HTTPException(status_code=400, detail="No eligible questions match current exam scope")

    requested_count = STAGE_A_QUESTION_COUNT
    actual_count = min(requested_count, len(docs))
    shortened = actual_count < requested_count

    by_difficulty: dict[str, list[dict]] = {"easy": [], "medium": [], "hard": []}
    for doc in docs:
        diff = doc.get("difficulty")
        if diff in by_difficulty:
            by_difficulty[diff].append(doc)

    for bucket in by_difficulty.values():
        random.shuffle(bucket)

    targets = {
        "easy": int(actual_count * STAGE_A_BLUEPRINT["easy"]),
        "medium": int(actual_count * STAGE_A_BLUEPRINT["medium"]),
        "hard": int(actual_count * STAGE_A_BLUEPRINT["hard"]),
    }
    targets["medium"] += actual_count - sum(targets.values())

    selected: list[dict] = []
    used_ids: set[str] = set()

    for diff, target in targets.items():
        bucket = by_difficulty[diff]
        take = min(target, len(bucket))
        for doc in bucket[:take]:
            selected.append(doc)
            used_ids.add(doc["question_id"])

    if len(selected) < actual_count:
        remainder = [doc for doc in docs if doc["question_id"] not in used_ids]
        random.shuffle(remainder)
        needed = actual_count - len(selected)
        selected.extend(remainder[:needed])

    random.shuffle(selected)

    items: list[dict] = []
    for i, doc in enumerate(selected[:actual_count], start=1):
        items.append(
            {
                "index": i,
                "question_id": doc["question_id"],
                "stem": doc["stem"],
                "options": doc["options"],
                "topic": doc["topic"],
                "chapter_id": doc.get("chapter_id") or doc.get("chapter_ref"),
                "difficulty": doc["difficulty"],
                "correct_option": doc["correct_option"],
                "explanation": doc["explanation"],
                "selected_option": None,
                "is_correct": None,
                "answered_at": None,
            }
        )
    return items, requested_count, actual_count, shortened


def _session_to_out(session_doc: dict) -> dict:
    items = []
    for item in session_doc["items"]:
        items.append(
            {
                "index": item["index"],
                "question_id": item["question_id"],
                "stem": item["stem"],
                "options": item["options"],
                "topic": item["topic"],
                "chapter_id": item.get("chapter_id"),
                "difficulty": item["difficulty"],
                "selected_option": item.get("selected_option"),
                "is_correct": item.get("is_correct"),
                "answered_at": item.get("answered_at"),
            }
        )

    return {
        "session_id": session_doc["session_id"],
        "exam_type": "stage-a",
        "status": session_doc["status"],
        "blueprint_version": session_doc["blueprint_version"],
        "requested_question_count": session_doc.get("requested_question_count", session_doc["question_count"]),
        "actual_question_count": session_doc.get("actual_question_count", session_doc["question_count"]),
        "shortened_due_to_pool": bool(session_doc.get("shortened_due_to_pool", False)),
        "scope": session_doc.get("scope", _normalized_scope(None)),
        "question_count": session_doc["question_count"],
        "duration_seconds": session_doc["duration_seconds"],
        "started_at": session_doc["started_at"],
        "expires_at": session_doc["expires_at"],
        "finalized_at": session_doc.get("finalized_at"),
        "items": items,
    }


def _build_review_items(session_doc: dict) -> list[dict]:
    out: list[dict] = []
    for item in session_doc["items"]:
        out.append(
            {
                "index": item["index"],
                "question_id": item["question_id"],
                "stem": item["stem"],
                "options": item["options"],
                "topic": item["topic"],
                "chapter_id": item.get("chapter_id"),
                "difficulty": item["difficulty"],
                "selected_option": item.get("selected_option"),
                "is_correct": item.get("is_correct"),
                "correct_option": item.get("correct_option"),
                "explanation": item.get("explanation"),
            }
        )
    return out


def _build_questions_query(
    topic: Optional[str], chapter_id: Optional[str], difficulty: Optional[Difficulty], search: Optional[str]
) -> dict:
    query: dict = {"is_chain": {"$ne": True}}
    and_filters: list[dict] = []
    if topic:
        query["topic"] = topic
    if chapter_id:
        and_filters.append({"$or": [{"chapter_id": chapter_id}, {"chapter_ref": chapter_id}]})
    if difficulty:
        query["difficulty"] = difficulty.value
    if search:
        and_filters.append(
            {
                "$or": [
                    {"stem": {"$regex": search, "$options": "i"}},
                    {"topic": {"$regex": search, "$options": "i"}},
                ]
            }
        )
    if and_filters:
        query["$and"] = and_filters
    return query


def _list_questions(
    db: Database,
    topic: Optional[str],
    chapter_id: Optional[str],
    difficulty: Optional[Difficulty],
    search: Optional[str],
    has_followups: Optional[bool],
    limit: int,
    offset: int,
) -> List[dict]:
    query = _build_questions_query(topic, chapter_id, difficulty, search)

    if has_followups:
        parent_ids = db["question_followups"].distinct(
            "parent_question_id",
            {"trigger": "correct"},
        )
        if not parent_ids:
            return []
        query["question_id"] = {"$in": parent_ids}

    docs = db["questions"].find(query, {"_id": 0}).skip(offset).limit(limit)
    return [_doc_to_question_out(doc) for doc in docs]


@router.get("", response_model=List[QuestionOut])
def get_questions(
    topic: Optional[str] = Query(None),
    chapter_id: Optional[str] = Query(None),
    difficulty: Optional[Difficulty] = Query(None),
    search: Optional[str] = Query(None),
    has_followups: Optional[bool] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    return _list_questions(
        db,
        topic,
        chapter_id,
        difficulty,
        search,
        has_followups,
        limit,
        offset,
    )


@router.get("/", response_model=List[QuestionOut], include_in_schema=False)
def get_questions_with_trailing_slash(
    topic: Optional[str] = Query(None),
    chapter_id: Optional[str] = Query(None),
    difficulty: Optional[Difficulty] = Query(None),
    search: Optional[str] = Query(None),
    has_followups: Optional[bool] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    return _list_questions(
        db,
        topic,
        chapter_id,
        difficulty,
        search,
        has_followups,
        limit,
        offset,
    )


class AnsweredCorrectlyResponse(BaseModel):
    question_ids: List[str]


@router.get("/answered-correctly", response_model=AnsweredCorrectlyResponse)
def get_answered_correctly(
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    ids = db["question_attempts"].distinct(
        "question_id",
        {"user_id": ObjectId(current_user), "is_correct": True},
    )
    return {"question_ids": [str(qid) for qid in ids]}


@router.get("/topics", response_model=List[str])
def get_question_topics(
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    topics = db["questions"].distinct("topic")
    return sorted([t for t in topics if isinstance(t, str) and t.strip()])


class AttemptHistoryItem(BaseModel):
    attempt_id: str
    question_id: str
    stem: str
    selected_option: int
    correct_option: int
    is_correct: bool
    created_at: datetime


class AttemptHistoryResponse(BaseModel):
    items: List[AttemptHistoryItem]
    total: int


class DeleteHistoryResponse(BaseModel):
    deleted_count: int


@router.get("/history", response_model=AttemptHistoryResponse)
def get_question_history(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    user_oid = ObjectId(current_user)
    query = {"user_id": user_oid}
    total = db["question_attempts"].count_documents(query)
    attempts = list(
        db["question_attempts"]
        .find(query)
        .sort("created_at", -1)
        .skip(offset)
        .limit(limit)
    )
    question_ids = [a["question_id"] for a in attempts]
    stem_map = {
        q["question_id"]: q["stem"]
        for q in db["questions"].find(
            {"question_id": {"$in": question_ids}},
            {"question_id": 1, "stem": 1, "_id": 0},
        )
    }
    items = [
        AttemptHistoryItem(
            attempt_id=str(a["_id"]),
            question_id=a["question_id"],
            stem=stem_map.get(a["question_id"], ""),
            selected_option=a["selected_option"],
            correct_option=a["correct_option"],
            is_correct=a["is_correct"],
            created_at=a["created_at"],
        )
        for a in attempts
    ]
    return AttemptHistoryResponse(items=items, total=total)


@router.delete("/history", response_model=DeleteHistoryResponse)
def delete_question_history(
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    result = db["question_attempts"].delete_many({"user_id": ObjectId(current_user)})
    return DeleteHistoryResponse(deleted_count=result.deleted_count)


class SelectiveDeleteRequest(BaseModel):
    question_ids: List[str]


@router.delete("/history/selected", response_model=DeleteHistoryResponse)
def delete_question_history_selected(
    body: SelectiveDeleteRequest,
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    result = db["question_attempts"].delete_many(
        {"user_id": ObjectId(current_user), "question_id": {"$in": body.question_ids}}
    )
    return DeleteHistoryResponse(deleted_count=result.deleted_count)


@router.post("/exam-sessions/stage-a/start", response_model=StageAExamSessionOut)
def start_stage_a_exam_session(
    body: StageAStartRequest = StageAStartRequest(),
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    user_oid = ObjectId(current_user)
    now = datetime.now(timezone.utc)
    scope = _normalized_scope(body)

    active = db["exam_sessions"].find_one(
        {"user_id": user_oid, "exam_type": "stage-a", "status": "active"},
        sort=[("started_at", -1)],
    )
    if active:
        if _remaining_seconds(active) <= 0:
            scored = _score_stage_a(active)
            db["exam_sessions"].update_one(
                {"_id": active["_id"]},
                {
                    "$set": {
                        "status": "expired",
                        "finalized_at": now,
                        "report": scored,
                    }
                },
            )
        else:
            return _session_to_out(active)

    session_doc = {
        "session_id": f"stage_a_{uuid.uuid4().hex[:12]}",
        "user_id": user_oid,
        "exam_type": "stage-a",
        "status": "active",
        "blueprint_version": STAGE_A_BLUEPRINT_VERSION,
        "requested_question_count": STAGE_A_QUESTION_COUNT,
        "actual_question_count": 0,
        "shortened_due_to_pool": False,
        "scope": scope,
        "question_count": STAGE_A_QUESTION_COUNT,
        "duration_seconds": STAGE_A_DURATION_SECONDS,
        "started_at": now,
        "expires_at": now + timedelta(seconds=STAGE_A_DURATION_SECONDS),
        "finalized_at": None,
        "items": [],
        "report": None,
    }
    items, requested_count, actual_count, shortened = _build_stage_a_items(db, current_user, scope)
    session_doc["items"] = items
    session_doc["requested_question_count"] = requested_count
    session_doc["actual_question_count"] = actual_count
    session_doc["shortened_due_to_pool"] = shortened
    session_doc["question_count"] = actual_count
    db["exam_sessions"].insert_one(session_doc)
    return _session_to_out(session_doc)


@router.post("/exam-sessions/stage-a/preview", response_model=StageAPreviewOut)
def preview_stage_a_exam_session(
    body: StageAStartRequest = StageAStartRequest(),
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    scope = _normalized_scope(body)
    eligible = _eligible_stage_a_docs(db, current_user, scope)
    eligible_count = len(eligible)
    requested = STAGE_A_QUESTION_COUNT
    actual = min(requested, eligible_count)
    return {
        "eligible_count": eligible_count,
        "requested_question_count": requested,
        "actual_question_count": actual,
        "shortened_due_to_pool": actual < requested,
    }


@router.get("/exam-sessions/stage-a/active", response_model=StageAExamSessionOut)
def get_active_stage_a_exam_session(
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    active = db["exam_sessions"].find_one(
        {"user_id": ObjectId(current_user), "exam_type": "stage-a", "status": "active"},
        sort=[("started_at", -1)],
    )
    if not active:
        raise HTTPException(status_code=404, detail="No active Stage A session")

    if _remaining_seconds(active) <= 0:
        now = datetime.now(timezone.utc)
        scored = _score_stage_a(active)
        db["exam_sessions"].update_one(
            {"_id": active["_id"]},
            {"$set": {"status": "expired", "finalized_at": now, "report": scored}},
        )
        active["status"] = "expired"
        active["finalized_at"] = now

    return _session_to_out(active)


def _preset_to_out(doc: dict) -> dict:
    return {
        "preset_id": doc["preset_id"],
        "name": doc["name"],
        "topics": doc.get("topics", []),
        "part_numbers": doc.get("part_numbers", []),
        "chapter_ids": doc.get("chapter_ids", []),
        "exclude_answered_correctly": bool(doc.get("exclude_answered_correctly", False)),
        "created_at": doc["created_at"],
        "updated_at": doc["updated_at"],
    }


@router.get("/exam-presets/stage-a", response_model=List[StageAExamPresetOut])
def list_stage_a_exam_presets(
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    docs = list(
        db["exam_presets"]
        .find(
            {"user_id": ObjectId(current_user), "exam_type": EXAM_PRESET_EXAM_TYPE},
            {"_id": 0},
        )
        .sort("updated_at", -1)
    )
    return [_preset_to_out(doc) for doc in docs]


@router.post("/exam-presets/stage-a", response_model=StageAExamPresetOut)
def create_stage_a_exam_preset(
    body: StageAExamPresetIn,
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    now = datetime.now(timezone.utc)
    scope = _normalized_scope(
        StageAStartRequest(
            topics=body.topics,
            part_numbers=body.part_numbers,
            chapter_ids=body.chapter_ids,
            exclude_answered_correctly=body.exclude_answered_correctly,
        )
    )
    doc = {
        "preset_id": f"preset_{uuid.uuid4().hex[:12]}",
        "user_id": ObjectId(current_user),
        "exam_type": EXAM_PRESET_EXAM_TYPE,
        "name": body.name.strip(),
        **scope,
        "created_at": now,
        "updated_at": now,
    }
    db["exam_presets"].insert_one(doc)
    return _preset_to_out(doc)


@router.patch("/exam-presets/stage-a/{preset_id}", response_model=StageAExamPresetOut)
def update_stage_a_exam_preset(
    preset_id: str,
    body: StageAExamPresetIn,
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    existing = db["exam_presets"].find_one(
        {"preset_id": preset_id, "user_id": ObjectId(current_user), "exam_type": EXAM_PRESET_EXAM_TYPE}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Preset not found")
    now = datetime.now(timezone.utc)
    scope = _normalized_scope(
        StageAStartRequest(
            topics=body.topics,
            part_numbers=body.part_numbers,
            chapter_ids=body.chapter_ids,
            exclude_answered_correctly=body.exclude_answered_correctly,
        )
    )
    update = {"name": body.name.strip(), **scope, "updated_at": now}
    db["exam_presets"].update_one({"_id": existing["_id"]}, {"$set": update})
    existing.update(update)
    return _preset_to_out(existing)


@router.delete("/exam-presets/stage-a/{preset_id}")
def delete_stage_a_exam_preset(
    preset_id: str,
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    result = db["exam_presets"].delete_one(
        {"preset_id": preset_id, "user_id": ObjectId(current_user), "exam_type": EXAM_PRESET_EXAM_TYPE}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Preset not found")
    return {"deleted": True}


def _get_stage_a_session_for_user(db: Database, current_user: str, session_id: str) -> dict:
    session = db["exam_sessions"].find_one(
        {"session_id": session_id, "user_id": ObjectId(current_user), "exam_type": "stage-a"}
    )
    if not session:
        raise HTTPException(status_code=404, detail="Stage A session not found")
    return session


@router.post("/exam-sessions/stage-a/{session_id}/answer", response_model=StageAAnswerResult)
def answer_stage_a_exam_item(
    session_id: str,
    body: StageAAnswerCreate,
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    session = _get_stage_a_session_for_user(db, current_user, session_id)
    if session["status"] != "active":
        raise HTTPException(status_code=409, detail="Session is not active")

    remaining = _remaining_seconds(session)
    if remaining <= 0:
        now = datetime.now(timezone.utc)
        scored = _score_stage_a(session)
        db["exam_sessions"].update_one(
            {"_id": session["_id"]},
            {"$set": {"status": "expired", "finalized_at": now, "report": scored}},
        )
        raise HTTPException(status_code=409, detail="Session has expired")

    if body.index > len(session["items"]):
        raise HTTPException(status_code=400, detail="Invalid item index")

    item = session["items"][body.index - 1]
    if item.get("selected_option") is not None:
        raise HTTPException(status_code=409, detail="Item already answered")

    selected = int(body.selected_option)
    correct_option = int(item["correct_option"])
    is_correct = selected == correct_option
    answered_at = datetime.now(timezone.utc)

    update_fields = {
        f"items.{body.index - 1}.selected_option": selected,
        f"items.{body.index - 1}.is_correct": is_correct,
        f"items.{body.index - 1}.answered_at": answered_at,
        f"items.{body.index - 1}.rationale_text": body.rationale_text,
    }
    db["exam_sessions"].update_one({"_id": session["_id"]}, {"$set": update_fields})

    item["selected_option"] = selected
    item["is_correct"] = is_correct
    item["answered_at"] = answered_at

    scored = _score_stage_a(session)
    return {
        "correct": is_correct,
        "correct_option": correct_option,
        "explanation": item["explanation"],
        "answered_count": scored["answered_count"],
        "correct_count": scored["correct_count"],
        "remaining_seconds": max(0, remaining),
    }


@router.post("/exam-sessions/stage-a/{session_id}/finalize", response_model=StageAReportOut)
def finalize_stage_a_exam_session(
    session_id: str,
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    session = _get_stage_a_session_for_user(db, current_user, session_id)

    if session.get("report") and session["status"] in {"finalized", "expired"}:
        report = session["report"]
        finalized_at = session.get("finalized_at") or datetime.now(timezone.utc)
    else:
        report = _score_stage_a(session)
        finalized_at = datetime.now(timezone.utc)
        next_status = "expired" if _remaining_seconds(session) <= 0 else "finalized"
        db["exam_sessions"].update_one(
            {"_id": session["_id"]},
            {"$set": {"status": next_status, "finalized_at": finalized_at, "report": report}},
        )
        session["status"] = next_status

    elapsed = int((finalized_at - _to_utc_datetime(session["started_at"])).total_seconds())
    elapsed = max(0, min(elapsed, int(session["duration_seconds"])))

    return {
        "session_id": session["session_id"],
        "status": session["status"],
        "question_count": session["question_count"],
        "requested_question_count": session.get("requested_question_count", session["question_count"]),
        "actual_question_count": session.get("actual_question_count", session["question_count"]),
        "shortened_due_to_pool": bool(session.get("shortened_due_to_pool", False)),
        "scope": session.get("scope", _normalized_scope(None)),
        "answered_count": report["answered_count"],
        "correct_count": report["correct_count"],
        "percent_correct": report["percent_correct"],
        "started_at": session["started_at"],
        "finalized_at": finalized_at,
        "duration_seconds": session["duration_seconds"],
        "elapsed_seconds": elapsed,
        "by_topic": report["by_topic"],
        "by_difficulty": report["by_difficulty"],
        "review_items": _build_review_items(session),
    }


@router.get("/exam-sessions/stage-a/{session_id}/report", response_model=StageAReportOut)
def get_stage_a_exam_session_report(
    session_id: str,
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    session = _get_stage_a_session_for_user(db, current_user, session_id)
    if session["status"] == "active":
        raise HTTPException(status_code=409, detail="Session is still active")

    report = session.get("report") or _score_stage_a(session)
    finalized_at = session.get("finalized_at") or datetime.now(timezone.utc)
    elapsed = int((finalized_at - _to_utc_datetime(session["started_at"])).total_seconds())
    elapsed = max(0, min(elapsed, int(session["duration_seconds"])))

    return {
        "session_id": session["session_id"],
        "status": session["status"],
        "question_count": session["question_count"],
        "requested_question_count": session.get("requested_question_count", session["question_count"]),
        "actual_question_count": session.get("actual_question_count", session["question_count"]),
        "shortened_due_to_pool": bool(session.get("shortened_due_to_pool", False)),
        "scope": session.get("scope", _normalized_scope(None)),
        "answered_count": report["answered_count"],
        "correct_count": report["correct_count"],
        "percent_correct": report["percent_correct"],
        "started_at": session["started_at"],
        "finalized_at": finalized_at,
        "duration_seconds": session["duration_seconds"],
        "elapsed_seconds": elapsed,
        "by_topic": report["by_topic"],
        "by_difficulty": report["by_difficulty"],
        "review_items": _build_review_items(session),
    }


@router.get("/{question_id}", response_model=QuestionFull)
def get_question(
    question_id: str,
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    doc = db["questions"].find_one({"question_id": question_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Question not found")
    return _doc_to_question_full(doc)


@router.get("/{question_id}/followups", response_model=List[QuestionOut])
def get_question_followups(
    question_id: str,
    trigger: str = Query("correct"),
    limit: int = Query(3, ge=1, le=10),
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    parent_exists = db["questions"].find_one({"question_id": question_id}, {"_id": 1})
    if not parent_exists:
        raise HTTPException(status_code=404, detail="Question not found")

    links = list(
        db["question_followups"]
        .find(
            {"parent_question_id": question_id, "trigger": trigger},
            {"_id": 0, "followup_question_id": 1, "priority": 1},
        )
        .sort("priority", 1)
        .limit(limit)
    )

    if not links:
        return []

    followup_ids = [link["followup_question_id"] for link in links if "followup_question_id" in link]
    if not followup_ids:
        return []

    followup_docs = list(
        db["questions"].find(
            {"question_id": {"$in": followup_ids}},
            {"_id": 0},
        )
    )
    by_id = {doc["question_id"]: doc for doc in followup_docs}

    ordered = []
    for followup_id in followup_ids:
        doc = by_id.get(followup_id)
        if doc:
            ordered.append(_doc_to_question_out(doc))

    return ordered


@router.post("/{question_id}/attempt", response_model=AttemptResult)
def attempt_question(
    question_id: str,
    attempt: QuestionAttemptCreate,
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
    redis: Redis = Depends(redis_client),
):
    question = db.questions.find_one({"question_id": question_id})

    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    attempt_db = record_attempt(
        db,
        redis,
        user_id=current_user,
        question_id=question_id,
        selected_option=attempt.selected_option,
        correct_option=question["correct_option"],
    )

    return {
        "correct": attempt_db.is_correct,
        "correct_option": question["correct_option"],
        "explanation": question["explanation"],
    }
