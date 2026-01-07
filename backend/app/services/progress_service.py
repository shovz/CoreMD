from bson import ObjectId
from app.models.user_progress import UserProgressInDB

PROGRESS_COLLECTION = "user_progress"


def record_progress(db, user_id: str, progress_in):
    progress = UserProgressInDB(
        user_id=ObjectId(user_id),
        chapter_id=progress_in.chapter_id,
        question_id=progress_in.question_id,
        case_id=progress_in.case_id,
        is_correct=progress_in.is_correct,
        completed=progress_in.completed,
    )

    db[PROGRESS_COLLECTION].insert_one(progress.to_mongo())
    return progress
