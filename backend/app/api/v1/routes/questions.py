from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from redis import Redis
from pymongo.database import Database

from app.core.auth import get_current_user
from app.schemas.question import QuestionOut, QuestionFull, Difficulty
from app.schemas.question_attempt import QuestionAttemptCreate, AttemptResult
from app.services.question_attempt_service import record_attempt
from app.db.deps import mongo_db, redis_client


router = APIRouter(
    prefix="/questions",
    tags=["questions"]
)


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


@router.get("", response_model=List[QuestionOut])
def get_questions(
    topic: Optional[str] = Query(None),
    chapter_id: Optional[str] = Query(None),
    difficulty: Optional[Difficulty] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: str = Depends(get_current_user),
    db: Database = Depends(mongo_db),
):
    query: dict = {}
    if topic:
        query["topic"] = topic
    if chapter_id:
        query["chapter_ref"] = chapter_id
    if difficulty:
        query["difficulty"] = difficulty.value

    docs = db["questions"].find(query, {"_id": 0}).skip(offset).limit(limit)
    return [_doc_to_question_out(doc) for doc in docs]


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
