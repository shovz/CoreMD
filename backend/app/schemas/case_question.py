from pydantic import BaseModel, Field
from typing import List


class CaseQuestionOut(BaseModel):
    case_question_id: str
    case_id: str
    step: int = Field(ge=1)
    stem: str
    options: List[str]
    correct_option: int
    explanation: str

    class Config:
        orm_mode = True


class CaseAttemptCreate(BaseModel):
    selected_option: int


class CaseAttemptResult(BaseModel):
    correct: bool
    correct_option: int
    explanation: str
