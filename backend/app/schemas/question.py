from pydantic import BaseModel
from typing import List
from enum import Enum


class Difficulty(str, Enum):
    easy = "easy"
    medium = "medium"
    hard = "hard"


class QuestionOut(BaseModel):
    question_id: str
    stem: str
    options: List[str]
    topic: str
    chapter_ref: str
    difficulty: Difficulty

    class Config:
        orm_mode = True


class QuestionFull(QuestionOut):
    correct_option: int
    explanation: str
