from fastapi import APIRouter, Depends
from typing import List
from pymongo.database import Database

from app.db.deps import mongo_db
from app.schemas.chapter import ChapterOut

router = APIRouter(
    prefix="/chapters",
    tags=["chapters"]
)


@router.get("/", response_model=List[ChapterOut])
def get_chapters(db: Database = Depends(mongo_db)):
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
