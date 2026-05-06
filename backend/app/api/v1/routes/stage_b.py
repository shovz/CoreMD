import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from openai import OpenAI
from pymongo.database import Database
from redis import Redis

from app.core.auth import get_current_user_id
from app.core.config import settings
from app.db.deps import mongo_db, redis_client
from app.schemas.stage_b import (
    StageBAnswerCreate,
    StageBAnswerResult,
    StageBReportOut,
    StageBSessionOut,
    StageBStartRequest,
)
from app.services.audio_service import build_stage_tts_text, get_or_generate_tts, transcribe_audio
from app.services.case_generation_service import generate_rolling_case
from app.services.grading_service import grade_oral_answer

router = APIRouter(prefix="/stage-b", tags=["stage-b"])

_DEFAULT_TOPICS = [
    "Cardiology",
    "Pulmonology",
    "Gastroenterology",
    "Nephrology",
    "Infectious Disease",
    "Hematology",
    "Endocrinology",
    "Neurology",
]


def _to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _remaining_seconds(session_doc: dict) -> int:
    now = datetime.now(timezone.utc)
    return max(0, int((_to_utc(session_doc["expires_at"]) - now).total_seconds()))


def _question_to_out(q: dict) -> dict:
    return {
        "question_id": q["question_id"],
        "stage_index": q["stage_index"],
        "stem": q["stem"],
        "topic": q["topic"],
        "difficulty": q["difficulty"],
        "student_answer": q.get("student_answer"),
        "answer_mode": q.get("answer_mode"),
        "score": q.get("score"),
        "feedback": q.get("feedback"),
        "key_points_hit": q.get("key_points_hit"),
        "answered_at": q.get("answered_at"),
    }


def _question_to_full(q: dict) -> dict:
    return {
        **_question_to_out(q),
        "model_answer": q.get("model_answer"),
        "key_points": q.get("key_points"),
    }


def _session_to_out(session_doc: dict) -> dict:
    cases = []
    for case in session_doc["cases"]:
        stages = [
            {
                "stage_index": stage["stage_index"],
                "title": stage["title"],
                "context": stage["context"],
                "questions": [_question_to_out(q) for q in stage["questions"]],
            }
            for stage in case["stages"]
        ]
        cases.append({
            "case_index": case["case_index"],
            "case_id": case["case_id"],
            "title": case["title"],
            "chief_complaint": case["chief_complaint"],
            "stages": stages,
        })
    return {
        "session_id": session_doc["session_id"],
        "exam_type": "stage-b",
        "status": session_doc["status"],
        "difficulty": session_doc["difficulty"],
        "voice": session_doc["voice"],
        "case_count": session_doc["case_count"],
        "duration_minutes": session_doc["duration_minutes"],
        "started_at": session_doc["started_at"],
        "expires_at": session_doc["expires_at"],
        "finalized_at": session_doc.get("finalized_at"),
        "current_case_idx": session_doc["current_case_idx"],
        "current_stage_idx": session_doc["current_stage_idx"],
        "cases": cases,
    }


def _compute_report(session_doc: dict) -> dict:
    all_questions = [
        q
        for case in session_doc["cases"]
        for stage in case["stages"]
        for q in stage["questions"]
    ]
    answered = [q for q in all_questions if q.get("score") is not None]
    total_questions = len(all_questions)
    answered_count = len(answered)
    avg_score = sum(q["score"] for q in answered) / answered_count if answered else None

    topic_map: dict = {}
    diff_map: dict = {}
    for q in all_questions:
        topic = q["topic"]
        diff = q["difficulty"]
        if topic not in topic_map:
            topic_map[topic] = {"topic": topic, "total": 0, "answered": 0, "scores": []}
        if diff not in diff_map:
            diff_map[diff] = {"difficulty": diff, "total": 0, "answered": 0, "scores": []}
        topic_map[topic]["total"] += 1
        diff_map[diff]["total"] += 1
        if q.get("score") is not None:
            topic_map[topic]["answered"] += 1
            topic_map[topic]["scores"].append(q["score"])
            diff_map[diff]["answered"] += 1
            diff_map[diff]["scores"].append(q["score"])

    by_topic = []
    for row in sorted(topic_map.values(), key=lambda r: r["topic"]):
        scores = row.pop("scores")
        row["avg_score"] = round(sum(scores) / len(scores), 2) if scores else None
        by_topic.append(row)

    by_difficulty = []
    for row in sorted(diff_map.values(), key=lambda r: r["difficulty"]):
        scores = row.pop("scores")
        row["avg_score"] = round(sum(scores) / len(scores), 2) if scores else None
        by_difficulty.append(row)

    cases_report = []
    for case in session_doc["cases"]:
        case_qs = [q for stage in case["stages"] for q in stage["questions"]]
        case_answered = [q for q in case_qs if q.get("score") is not None]
        case_avg = sum(q["score"] for q in case_answered) / len(case_answered) if case_answered else None
        stages_report = [
            {
                "stage_index": stage["stage_index"],
                "title": stage["title"],
                "context": stage["context"],
                "questions": [_question_to_full(q) for q in stage["questions"]],
            }
            for stage in case["stages"]
        ]
        cases_report.append({
            "case_index": case["case_index"],
            "case_id": case["case_id"],
            "title": case["title"],
            "chief_complaint": case["chief_complaint"],
            "stages": stages_report,
            "answered_count": len(case_answered),
            "total_questions": len(case_qs),
            "avg_score": round(case_avg, 2) if case_avg is not None else None,
        })

    finalized_at = session_doc.get("finalized_at") or datetime.now(timezone.utc)
    elapsed = int((_to_utc(finalized_at) - _to_utc(session_doc["started_at"])).total_seconds())

    return {
        "session_id": session_doc["session_id"],
        "status": session_doc["status"],
        "difficulty": session_doc["difficulty"],
        "voice": session_doc["voice"],
        "case_count": session_doc["case_count"],
        "duration_minutes": session_doc["duration_minutes"],
        "started_at": session_doc["started_at"],
        "finalized_at": finalized_at,
        "elapsed_seconds": max(0, elapsed),
        "total_questions": total_questions,
        "answered_count": answered_count,
        "avg_score": round(avg_score, 2) if avg_score is not None else None,
        "by_topic": by_topic,
        "by_difficulty": by_difficulty,
        "cases": cases_report,
    }


def _get_session(db: Database, session_id: str, current_user: str) -> dict:
    session = db["stage_b_sessions"].find_one(
        {"session_id": session_id, "user_id": ObjectId(current_user)}
    )
    if not session:
        raise HTTPException(status_code=404, detail="Stage B session not found")
    return session


def _build_case_doc(raw_case: dict, case_index: int, difficulty: str, topic: str) -> dict:
    stages = []
    for raw_stage in raw_case.get("stages", []):
        stage_index = raw_stage.get("stage_num", 1) - 1
        questions = [
            {
                "question_id": f"sbq_{uuid.uuid4().hex[:12]}",
                "stage_index": stage_index,
                "stem": raw_q.get("text", ""),
                "topic": topic,
                "difficulty": difficulty,
                "model_answer": raw_q.get("model_answer", ""),
                "key_points": raw_q.get("key_points", []),
                "student_answer": None,
                "answer_mode": None,
                "score": None,
                "feedback": None,
                "key_points_hit": None,
                "answered_at": None,
            }
            for raw_q in raw_stage.get("questions", [])
        ]
        stages.append({
            "stage_index": stage_index,
            "title": raw_stage.get("title", f"Stage {stage_index + 1}"),
            "context": raw_stage.get("revelation", ""),
            "questions": questions,
        })
    stages.sort(key=lambda s: s["stage_index"])
    return {
        "case_index": case_index,
        "case_id": raw_case.get("case_id", str(uuid.uuid4())),
        "title": topic,
        "chief_complaint": raw_case.get("patient_summary", ""),
        "stages": stages,
    }


@router.post("/sessions/start", response_model=StageBSessionOut)
def start_stage_b_session(
    body: StageBStartRequest = StageBStartRequest(),
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    user_oid = ObjectId(current_user)
    now = datetime.now(timezone.utc)

    active = db["stage_b_sessions"].find_one(
        {"user_id": user_oid, "status": "active"},
        sort=[("started_at", -1)],
    )
    if active:
        if _remaining_seconds(active) > 0:
            return _session_to_out(active)
        db["stage_b_sessions"].update_one(
            {"_id": active["_id"]},
            {"$set": {"status": "expired", "finalized_at": now}},
        )

    topics = [t.strip() for t in body.topics if isinstance(t, str) and t.strip()]
    if not topics:
        topics = _DEFAULT_TOPICS[: body.case_count]
    case_topics = [topics[i % len(topics)] for i in range(body.case_count)]
    difficulty_val = body.difficulty.value if hasattr(body.difficulty, "value") else str(body.difficulty)

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    raw_cases: list = [None] * body.case_count
    with ThreadPoolExecutor(max_workers=body.case_count) as executor:
        future_to_idx = {
            executor.submit(generate_rolling_case, client, case_topics[i], difficulty_val): i
            for i in range(body.case_count)
        }
        for future in as_completed(future_to_idx):
            raw_cases[future_to_idx[future]] = future.result()

    cases = [_build_case_doc(raw_cases[i], i, difficulty_val, case_topics[i]) for i in range(body.case_count)]

    session_doc = {
        "session_id": f"stage_b_{uuid.uuid4().hex[:12]}",
        "user_id": user_oid,
        "exam_type": "stage-b",
        "status": "active",
        "difficulty": difficulty_val,
        "voice": body.voice,
        "case_count": body.case_count,
        "duration_minutes": body.duration_minutes,
        "started_at": now,
        "expires_at": now + timedelta(minutes=body.duration_minutes),
        "finalized_at": None,
        "current_case_idx": 0,
        "current_stage_idx": 0,
        "cases": cases,
        "report": None,
    }
    db["stage_b_sessions"].insert_one(session_doc)
    return _session_to_out(session_doc)


@router.get("/sessions/active", response_model=StageBSessionOut)
def get_active_stage_b_session(
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    active = db["stage_b_sessions"].find_one(
        {"user_id": ObjectId(current_user), "status": "active"},
        sort=[("started_at", -1)],
    )
    if not active:
        raise HTTPException(status_code=404, detail="No active Stage B session")
    return _session_to_out(active)


@router.post("/sessions/{session_id}/tts/{case_idx}/{stage_idx}")
def get_stage_tts(
    session_id: str,
    case_idx: int,
    stage_idx: int,
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
    redis: Redis = Depends(redis_client),
):
    session = _get_session(db, session_id, current_user)
    if session["status"] != "active":
        raise HTTPException(status_code=409, detail="Session is not active")

    cases = session["cases"]
    if case_idx < 0 or case_idx >= len(cases):
        raise HTTPException(status_code=400, detail="case_idx out of range")
    stages = cases[case_idx]["stages"]
    if stage_idx < 0 or stage_idx >= len(stages):
        raise HTTPException(status_code=400, detail="stage_idx out of range")
    stage = stages[stage_idx]

    cache_key = f"stage_b:tts:{session_id}:{case_idx}:{stage_idx}"
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    tts_text = build_stage_tts_text(
        stage_idx + 1,
        stage["title"],
        stage["context"],
        [{"text": q["stem"]} for q in stage["questions"]],
    )
    audio_bytes = get_or_generate_tts(client, redis, cache_key, tts_text, session["voice"])
    return Response(content=audio_bytes, media_type="audio/mpeg")


@router.post("/sessions/{session_id}/transcribe/{case_idx}/{stage_idx}/{question_num}")
def transcribe_answer(
    session_id: str,
    case_idx: int,
    stage_idx: int,
    question_num: int,
    audio_file: UploadFile = File(...),
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    session = _get_session(db, session_id, current_user)
    if session["status"] != "active":
        raise HTTPException(status_code=409, detail="Session is not active")

    cases = session["cases"]
    if case_idx < 0 or case_idx >= len(cases):
        raise HTTPException(status_code=400, detail="case_idx out of range")
    stages = cases[case_idx]["stages"]
    if stage_idx < 0 or stage_idx >= len(stages):
        raise HTTPException(status_code=400, detail="stage_idx out of range")
    questions = stages[stage_idx]["questions"]
    if question_num < 0 or question_num >= len(questions):
        raise HTTPException(status_code=400, detail="question_num out of range")

    audio_bytes = audio_file.file.read()
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    transcription = transcribe_audio(client, audio_bytes, audio_file.filename or "audio.webm")
    return {"transcription": transcription}


@router.post("/sessions/{session_id}/answer/{case_idx}/{stage_idx}/{question_num}", response_model=StageBAnswerResult)
def submit_answer(
    session_id: str,
    case_idx: int,
    stage_idx: int,
    question_num: int,
    body: StageBAnswerCreate,
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    session = _get_session(db, session_id, current_user)
    if session["status"] != "active":
        raise HTTPException(status_code=409, detail="Session is not active")

    remaining = _remaining_seconds(session)
    if remaining <= 0:
        db["stage_b_sessions"].update_one(
            {"_id": session["_id"]},
            {"$set": {"status": "expired", "finalized_at": datetime.now(timezone.utc)}},
        )
        raise HTTPException(status_code=409, detail="Session has expired")

    cases = session["cases"]
    if case_idx < 0 or case_idx >= len(cases):
        raise HTTPException(status_code=400, detail="case_idx out of range")
    stages = cases[case_idx]["stages"]
    if stage_idx < 0 or stage_idx >= len(stages):
        raise HTTPException(status_code=400, detail="stage_idx out of range")
    questions = stages[stage_idx]["questions"]
    if question_num < 0 or question_num >= len(questions):
        raise HTTPException(status_code=400, detail="question_num out of range")

    q = questions[question_num]
    if q.get("score") is not None:
        raise HTTPException(status_code=409, detail="Question already answered")

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    result = grade_oral_answer(client, q["stem"], q["model_answer"], q["key_points"], body.student_answer)

    answered_at = datetime.now(timezone.utc)
    score_normalized = result["score"] / 10.0
    update_path = f"cases.{case_idx}.stages.{stage_idx}.questions.{question_num}"

    db["stage_b_sessions"].update_one(
        {"_id": session["_id"]},
        {
            "$set": {
                f"{update_path}.student_answer": body.student_answer,
                f"{update_path}.answer_mode": body.answer_mode,
                f"{update_path}.score": score_normalized,
                f"{update_path}.feedback": result["feedback"],
                f"{update_path}.key_points_hit": result["key_points_covered"],
                f"{update_path}.answered_at": answered_at,
            }
        },
    )

    questions[question_num]["score"] = score_normalized
    all_stage_answered = all(q.get("score") is not None for q in questions)

    return {
        "score": score_normalized,
        "feedback": result["feedback"],
        "key_points_hit": result["key_points_covered"],
        "model_answer": q["model_answer"],
        "remaining_seconds": remaining,
        "all_stage_questions_answered": all_stage_answered,
    }


@router.post("/sessions/{session_id}/advance-stage", response_model=StageBSessionOut)
def advance_stage(
    session_id: str,
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    session = _get_session(db, session_id, current_user)
    if session["status"] != "active":
        raise HTTPException(status_code=409, detail="Session is not active")

    current_case_idx = session["current_case_idx"]
    current_stage_idx = session["current_stage_idx"]
    cases = session["cases"]
    stage = cases[current_case_idx]["stages"][current_stage_idx]

    unanswered = [q for q in stage["questions"] if q.get("score") is None]
    if unanswered:
        raise HTTPException(
            status_code=409,
            detail=f"{len(unanswered)} question(s) in current stage not yet answered",
        )

    num_stages = len(cases[current_case_idx]["stages"])
    if current_stage_idx + 1 < num_stages:
        new_case_idx = current_case_idx
        new_stage_idx = current_stage_idx + 1
    elif current_case_idx + 1 < len(cases):
        new_case_idx = current_case_idx + 1
        new_stage_idx = 0
    else:
        new_case_idx = current_case_idx
        new_stage_idx = current_stage_idx

    db["stage_b_sessions"].update_one(
        {"_id": session["_id"]},
        {"$set": {"current_case_idx": new_case_idx, "current_stage_idx": new_stage_idx}},
    )
    session["current_case_idx"] = new_case_idx
    session["current_stage_idx"] = new_stage_idx
    return _session_to_out(session)


@router.post("/sessions/{session_id}/finalize", response_model=StageBReportOut)
def finalize_session(
    session_id: str,
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    session = _get_session(db, session_id, current_user)
    if session["status"] == "finalized":
        return _compute_report(session)

    now = datetime.now(timezone.utc)
    db["stage_b_sessions"].update_one(
        {"_id": session["_id"]},
        {"$set": {"status": "finalized", "finalized_at": now}},
    )
    session["status"] = "finalized"
    session["finalized_at"] = now
    return _compute_report(session)


@router.get("/sessions/{session_id}/report", response_model=StageBReportOut)
def get_session_report(
    session_id: str,
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    session = _get_session(db, session_id, current_user)
    if session["status"] != "finalized":
        raise HTTPException(status_code=409, detail="Session is not finalized")
    return _compute_report(session)
