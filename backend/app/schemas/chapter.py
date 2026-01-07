from pydantic import BaseModel, Field
from typing import List


class ChapterBase(BaseModel):
    title: str
    specialty: str


class ChapterOut(ChapterBase):
    id: str

    class Config:
        orm_mode = True

class ChapterCreate(BaseModel):
    title: str = Field(..., min_length=3)
    specialty: str = Field(..., min_length=3)