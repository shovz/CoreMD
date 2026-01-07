from datetime import datetime
from typing import Optional
from bson import ObjectId


class UserProgressInDB:
    def __init__(
        self,
        user_id: ObjectId,
        chapter_id: Optional[str] = None,
        question_id: Optional[str] = None,
        case_id: Optional[str] = None,
        is_correct: Optional[bool] = None,
        completed: bool = False,
        created_at: Optional[datetime] = None,
    ):
        self.user_id = user_id
        self.chapter_id = chapter_id
        self.question_id = question_id
        self.case_id = case_id
        self.is_correct = is_correct
        self.completed = completed
        self.created_at = created_at or datetime.utcnow()

    def to_mongo(self) -> dict:
        return {
            "user_id": self.user_id,
            "chapter_id": self.chapter_id,
            "question_id": self.question_id,
            "case_id": self.case_id,
            "is_correct": self.is_correct,
            "completed": self.completed,
            "created_at": self.created_at,
        }
