from pydantic import BaseModel
from typing import List


class ChapterBase(BaseModel):
    title: str
    specialty: str


class ChapterOut(ChapterBase):
    id: str

    class Config:
        orm_mode = True
