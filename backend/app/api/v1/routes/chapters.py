from fastapi import APIRouter, Depends
from typing import List
from pymongo.database import Database

from app.db.deps import mongo_db
from app.schemas.chapter import ChapterOut, ChapterCreate
from app.core.auth import get_current_user

router = APIRouter(
    prefix="/chapters",
    tags=["chapters"]
)

@router.get("/", response_model=List[ChapterOut])
def get_chapters(current_user: str = Depends(get_current_user),db: Database = Depends(mongo_db)):
    # Fake data for now — DB usage comes later
    return [
        {
            "id": "1",
            "title": "Infectious Diseases",
            "specialty": "Internal Medicine"
        },
        {
            "id": "2",
            "title": "Cardiovascular Disorders",
            "specialty": "Cardiology"
        }
    ]


@router.post("/", response_model=ChapterOut)
def create_chapter(
    chapter: ChapterCreate,
    current_user: str = Depends(get_current_user),  
    db: Database = Depends(mongo_db)                
):
    # Fake insert for now
    return {
        "id": "fake_id",
        "title": chapter.title,
        "specialty": chapter.specialty
    }