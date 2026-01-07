from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class UserProgressCreate(BaseModel):
    chapter_id: Optional[str] = None
    question_id: Optional[str] = None
    case_id: Optional[str] = None
    is_correct: Optional[bool] = None
    completed: bool = False


class UserProgressOut(UserProgressCreate):
    id: str
    created_at: datetime
