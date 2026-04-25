from pydantic import BaseModel
from typing import Optional


class CaseOut(BaseModel):
    case_id: str
    title: str
    specialty: str
    presentation: str
    history: str
    physical_exam: str
    labs: str
    imaging: str
    discussion: str
    diagnosis: str
    management: str
    chapter_ref: str
    chapter_title: Optional[str] = None

    class Config:
        orm_mode = True


class CaseListItem(BaseModel):
    case_id: str
    title: str
    specialty: str
    presentation: str

    class Config:
        orm_mode = True
