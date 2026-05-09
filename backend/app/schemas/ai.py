from pydantic import BaseModel
from pydantic import Field
from typing import List, Literal, Optional


class HistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=4000)


class SelectedContext(BaseModel):
    selected_text: str = Field(..., min_length=1, max_length=4000)
    chapter_id: str = Field(..., min_length=1, max_length=200)
    section_id: str = Field(..., min_length=1, max_length=200)
    chapter_title: Optional[str] = Field(default=None, max_length=500)
    section_title: Optional[str] = Field(default=None, max_length=500)


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)
    history: List[HistoryMessage] = Field(default_factory=list, max_length=20)
    selected_context: Optional[SelectedContext] = None


class Citation(BaseModel):
    chapter_id: str
    chapter_title: str
    section_id: Optional[str] = None
    section_title: str


class AskResponse(BaseModel):
    answer: str
    citations: List[Citation]
