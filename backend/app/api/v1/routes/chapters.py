from fastapi import APIRouter, Depends, HTTPException
from typing import List
from pymongo.database import Database

from app.db.deps import mongo_db
from app.schemas.chapter import ChapterOut, ChapterCreate
from app.core.auth import get_current_user

router = APIRouter(prefix="/chapters", tags=["chapters"])


@router.get("/", response_model=List[ChapterOut])
def get_chapters(
    current_user: str = Depends(get_current_user), db: Database = Depends(mongo_db)
):
    # Fake data for now — DB usage comes later
    return [
        {"id": "1", "title": "Infectious Diseases", "specialty": "Internal Medicine"},
        {"id": "2", "title": "Cardiovascular Disorders", "specialty": "Cardiology"},
    ]


@router.get("/{chapter_id}", response_model=ChapterOut)
def get_chapter_by_id(
    chapter_id: str,
    current_user: str = Depends(get_current_user),
    db: Database = Depends(mongo_db),
):
    chapters = [
        {
            "id": "1",
            "title": "Infectious Diseases",
            "specialty": "Internal Medicine",
            "sections": [
                {"id": "1-1", "title": "Approach to Fever"},
                {"id": "1-2", "title": "Sepsis and Septic Shock"},
            ],
        },
        {
            "id": "2",
            "title": "Cardiovascular Disorders",
            "specialty": "Cardiology",
            "sections": [
                {"id": "2-1", "title": "Heart Failure"},
                {"id": "2-2", "title": "Ischemic Heart Disease"},
            ],
        },
    ]

    chapter = next((c for c in chapters if c["id"] == chapter_id), None)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    return chapter

@router.get("/{chapter_id}/sections/{section_id}")
def get_section_by_id(
    chapter_id: str,
    section_id: str,
    current_user: str = Depends(get_current_user),
):
    chapters = [
        {
            "id": "1",
            "title": "Infectious Diseases",
            "specialty": "Internal Medicine",
            "sections": [
                {"id": "1-1", "title": "Approach to Fever"},
                {"id": "1-2", "title": "Sepsis and Septic Shock"},
            ],
        },
        {
            "id": "2",
            "title": "Cardiovascular Disorders",
            "specialty": "Cardiology",
            "sections": [
                {"id": "2-1", "title": "Heart Failure"},
                {"id": "2-2", "title": "Ischemic Heart Disease"},
            ],
        },
    ]

    chapter = next((c for c in chapters if c["id"] == chapter_id), None)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    section = next((s for s in chapter["sections"] if s["id"] == section_id), None)
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    return {
        "chapter_id": chapter["id"],
        "chapter_title": chapter["title"],
        "section_id": section["id"],
        "section_title": section["title"],
        "content": "Section content placeholder..."
    }

@router.post("/", response_model=ChapterOut)
def create_chapter(
    chapter: ChapterCreate,
    current_user: str = Depends(get_current_user),
    db: Database = Depends(mongo_db),
):
    # Fake insert for now
    return {"id": "fake_id", "title": chapter.title, "specialty": chapter.specialty}
