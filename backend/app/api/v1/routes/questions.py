from fastapi import APIRouter
from fastapi import Depends, HTTPException
from redis import Redis
from pymongo.database import Database

from app.core.auth import get_current_user
from app.schemas.question_attempt import QuestionAttemptCreate, QuestionAttemptOut
from app.services.question_attempt_service import record_attempt
from app.db.deps import mongo_db
from app.db.deps import redis_client


router = APIRouter(
    prefix="/questions",
    tags=["questions"]
)

@router.get("/")
def get_questions():
    return {"message": "List of questions (placeholder)"}


@router.post("/{question_id}/attempt", response_model=QuestionAttemptOut)
def attempt_question(
    question_id: str,
    attempt: QuestionAttemptCreate,
    current_user: str = Depends(get_current_user),
    db: Database = Depends(mongo_db),
    redis: Redis = Depends(redis_client),

):
    # TODO: load question from DB
    question = db.questions.find_one({"_id": question_id})

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
        "id": str(attempt_db.question_id),
        "question_id": question_id,
        "selected_option": attempt.selected_option,
        "is_correct": attempt_db.is_correct,
        "created_at": attempt_db.created_at,
    }
