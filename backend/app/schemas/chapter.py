from pydantic import BaseModel, Field
from typing import List, Optional


class ChapterBase(BaseModel):
    title: str
    specialty: str


class SectionOut(BaseModel):
    id: str
    title: str


class ChapterOut(ChapterBase):
    id: str
    part_number: Optional[int] = None
    part_title: Optional[str] = None
    chapter_number: Optional[int] = None
    sections: List[SectionOut] = Field(default_factory=list)

    class Config:
        orm_mode = True


class ChapterCreate(BaseModel):
    title: str = Field(..., min_length=3)
    specialty: str = Field(..., min_length=3)


class SectionContentOut(BaseModel):
    chapter_id: str
    chapter_title: str
    section_id: str
    section_title: str
    content: str
    html_content: Optional[str] = None


class ChapterSearchResult(BaseModel):
    chapter_id: str
    chapter_title: str
    chapter_number: Optional[int] = None
    part_number: Optional[int] = None
    part_title: Optional[str] = None
    occurrence_count: int
