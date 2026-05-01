from pydantic import BaseModel
from pydantic import Field
from typing import List


class HistoryMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class AskRequest(BaseModel):
    question: str
    history: List[HistoryMessage] = Field(default_factory=list)


class Citation(BaseModel):
    chapter_id: str
    chapter_title: str
    section_title: str


class AskResponse(BaseModel):
    answer: str
    citations: List[Citation]
