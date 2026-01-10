from pydantic import BaseModel
from datetime import datetime
from typing import Optional


# ---------------------------
# Input (from client)
# ---------------------------

class QuestionAttemptCreate(BaseModel):
    question_id: str
    selected_option: str
    time_spent_seconds: Optional[int] = None


# ---------------------------
# Output (to client)
# ---------------------------

class QuestionAttemptOut(BaseModel):
    id: str
    question_id: str
    selected_option: str
    is_correct: bool
    time_spent_seconds: Optional[int]
    created_at: datetime
