from bson import ObjectId
from app.models.question_attempt import QuestionAttemptInDB

ATTEMPTS_COLLECTION = "question_attempts"


def record_attempt(
    db,
    *,
    user_id: str,
    question_id: str,
    selected_option: str,
    correct_option: str,
):
    is_correct = selected_option == correct_option

    attempt = QuestionAttemptInDB(
        user_id=ObjectId(user_id),
        question_id=question_id,
        selected_option=selected_option,
        correct_option=correct_option,
        is_correct=is_correct,
    )

    db[ATTEMPTS_COLLECTION].insert_one(attempt.to_mongo())
    return attempt
