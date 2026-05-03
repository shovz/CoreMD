from pydantic import BaseModel
from pydantic import Field
from typing import List, Literal


class HistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=4000)


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)
    history: List[HistoryMessage] = Field(default_factory=list, max_length=20)


class Citation(BaseModel):
    chapter_id: str
    chapter_title: str
    section_title: str


class AskResponse(BaseModel):
    answer: str
    citations: List[Citation]
