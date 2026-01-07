from pydantic import BaseModel
from datetime import datetime


class QuestionAttemptCreate(BaseModel):
    question_id: str
    selected_option: str


class QuestionAttemptOut(QuestionAttemptCreate):
    id: str
    is_correct: bool
    created_at: datetime
