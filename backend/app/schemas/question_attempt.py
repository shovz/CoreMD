from pydantic import BaseModel
from datetime import datetime
from typing import Optional


# ---------------------------
# Input (from client)
# ---------------------------

class QuestionAttemptCreate(BaseModel):
    selected_option: int


# ---------------------------
# Output (to client)
# ---------------------------

class AttemptResult(BaseModel):
    correct: bool
    correct_option: int
    explanation: str


class QuestionAttemptOut(BaseModel):
    id: str
    question_id: str
    selected_option: int
    is_correct: bool
    time_spent_seconds: Optional[int]
    created_at: datetime
