from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from redis import Redis
from pymongo.database import Database
from bson import ObjectId
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.schemas.question import QuestionOut, QuestionFull, Difficulty
from app.schemas.question_attempt import QuestionAttemptCreate, AttemptResult
from app.services.question_attempt_service import record_attempt
from app.db.deps import mongo_db, redis_client


router = APIRouter(prefix="/questions", tags=["questions"])


def _doc_to_question_out(doc: dict) -> dict:
    return {
        "question_id": doc["question_id"],
        "stem": doc["stem"],
        "options": doc["options"],
        "topic": doc["topic"],
        "chapter_ref": doc["chapter_ref"],
        "difficulty": doc["difficulty"],
    }


def _doc_to_question_full(doc: dict) -> dict:
    return {
        **_doc_to_question_out(doc),
        "correct_option": doc["correct_option"],
        "explanation": doc["explanation"],
    }


def _build_questions_query(
    topic: Optional[str], chapter_id: Optional[str], difficulty: Optional[Difficulty], search: Optional[str]
) -> dict:
    query: dict = {"is_chain": {"$ne": True}}
    if topic:
        query["topic"] = topic
    if chapter_id:
        query["chapter_ref"] = chapter_id
    if difficulty:
        query["difficulty"] = difficulty.value
    if search:
        query["$or"] = [
            {"stem": {"$regex": search, "$options": "i"}},
            {"topic": {"$regex": search, "$options": "i"}},
        ]
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
    current_user: str = Depends(get_current_user),
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
    current_user: str = Depends(get_current_user),
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
    current_user: str = Depends(get_current_user),
    db: Database = Depends(mongo_db),
):
    ids = db["question_attempts"].distinct(
        "question_id",
        {"user_id": ObjectId(current_user), "is_correct": True},
    )
    return {"question_ids": [str(qid) for qid in ids]}


@router.get("/topics", response_model=List[str])
def get_question_topics(
    current_user: str = Depends(get_current_user),
    db: Database = Depends(mongo_db),
):
    topics = db["questions"].distinct("topic")
    return sorted([t for t in topics if isinstance(t, str) and t.strip()])


@router.get("/{question_id}", response_model=QuestionFull)
def get_question(
    question_id: str,
    current_user: str = Depends(get_current_user),
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
    current_user: str = Depends(get_current_user),
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
    current_user: str = Depends(get_current_user),
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
