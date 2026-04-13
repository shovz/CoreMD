from pydantic import BaseModel


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

    class Config:
        orm_mode = True


class CaseListItem(BaseModel):
    case_id: str
    title: str
    specialty: str

    class Config:
        orm_mode = True
