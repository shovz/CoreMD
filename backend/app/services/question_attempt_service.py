from redis import Redis
from bson import ObjectId
from app.models.question_attempt import QuestionAttemptInDB

ATTEMPTS_COLLECTION = "question_attempts"


def record_attempt(
    db,
    redis: Redis,
    *,
    user_id: str,
    question_id: str,
    selected_option: int,
    correct_option: int,
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

    redis.delete(f"stats:overview:{user_id}")
    redis.delete(f"stats:questions:{user_id}")
    redis.delete(f"stats:chapters:{user_id}")
    return attempt
