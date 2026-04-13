from datetime import datetime
from bson import ObjectId
from typing import Optional


class QuestionAttemptInDB:
    def __init__(
        self,
        user_id: ObjectId,
        question_id: str,
        selected_option: int,
        correct_option: int,
        is_correct: bool,
        created_at: Optional[datetime] = None,
    ):
        self.user_id = user_id
        self.question_id = question_id
        self.selected_option = selected_option
        self.correct_option = correct_option
        self.is_correct = is_correct
        self.created_at = created_at or datetime.utcnow()

    def to_mongo(self) -> dict:
        return {
            "user_id": self.user_id,
            "question_id": self.question_id,
            "selected_option": self.selected_option,
            "correct_option": self.correct_option,
            "is_correct": self.is_correct,
            "created_at": self.created_at,
        }
