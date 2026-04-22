from fastapi import APIRouter, Depends, HTTPException
from typing import List
from pymongo.database import Database

from app.db.deps import mongo_db
from app.schemas.chapter import ChapterOut, ChapterCreate, SectionOut, SectionContentOut
from app.core.auth import get_current_user

router = APIRouter(prefix="/chapters", tags=["chapters"])


def _doc_to_chapter_out(doc: dict) -> dict:
    """Map a MongoDB chapter document to a ChapterOut-compatible dict."""
    sections = [
        {"id": s["id"], "title": s["title"]}
        for s in doc.get("sections", [])
    ]
    return {
        "id": doc["chapter_id"],
        "title": doc.get("title", ""),
        "specialty": doc.get("specialty", ""),
        "part_number": doc.get("part_number"),
        "part_title": doc.get("part_title"),
        "chapter_number": doc.get("chapter_number"),
        "sections": sections,
    }


@router.get("", response_model=List[ChapterOut])
def get_chapters(
    current_user: str = Depends(get_current_user), db: Database = Depends(mongo_db)
):
    docs = db["chapters"].find({}, {"_id": 0})
    return [_doc_to_chapter_out(doc) for doc in docs]


@router.get("/{chapter_id}", response_model=ChapterOut)
def get_chapter_by_id(
    chapter_id: str,
    current_user: str = Depends(get_current_user),
    db: Database = Depends(mongo_db),
):
    doc = db["chapters"].find_one({"chapter_id": chapter_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return _doc_to_chapter_out(doc)


@router.get("/{chapter_id}/sections/{section_id}", response_model=SectionContentOut)
def get_section_by_id(
    chapter_id: str,
    section_id: str,
    current_user: str = Depends(get_current_user),
    db: Database = Depends(mongo_db),
):
    chapter_doc = db["chapters"].find_one({"chapter_id": chapter_id}, {"_id": 0})
    if not chapter_doc:
        raise HTTPException(status_code=404, detail="Chapter not found")

    section_meta = next(
        (s for s in chapter_doc.get("sections", []) if s["id"] == section_id),
        None,
    )
    if section_meta is None:
        raise HTTPException(status_code=404, detail="Section not found")

    chunks = list(
        db["text_chunks"].find(
            {"chapter_id": chapter_id, "section_id": section_id},
            {"_id": 0, "text": 1, "chunk_index": 1},
        ).sort("chunk_index", 1)
    )
    content = "\n\n".join(c["text"] for c in chunks)

    html_doc = db["section_html"].find_one(
        {"chapter_id": chapter_id, "section_id": section_id},
        {"_id": 0, "html_content": 1},
    )
    html_content = html_doc["html_content"] if html_doc else None

    return SectionContentOut(
        chapter_id=chapter_id,
        chapter_title=chapter_doc.get("title", ""),
        section_id=section_id,
        section_title=section_meta["title"],
        content=content,
        html_content=html_content,
    )


@router.post("", response_model=ChapterOut)
def create_chapter(
    chapter: ChapterCreate,
    current_user: str = Depends(get_current_user),
    db: Database = Depends(mongo_db),
):
    # Fake insert for now
    return {"id": "fake_id", "title": chapter.title, "specialty": chapter.specialty}
