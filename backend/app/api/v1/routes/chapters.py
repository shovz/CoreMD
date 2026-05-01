import re
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List
from pymongo.database import Database

from app.db.deps import mongo_db
from app.schemas.chapter import (
    ChapterOut,
    ChapterCreate,
    SectionContentOut,
    ChapterSearchResult,
)
from app.core.auth import get_current_user_id

router = APIRouter(prefix="/chapters", tags=["chapters"])


def _doc_to_chapter_out(doc: dict) -> dict:
    """Map a MongoDB chapter document to a ChapterOut-compatible dict."""
    sections = [{"id": s["id"], "title": s["title"]} for s in doc.get("sections", [])]
    return {
        "id": doc["chapter_id"],
        "title": doc.get("title", ""),
        "specialty": doc.get("specialty", ""),
        "part_number": doc.get("part_number"),
        "part_title": doc.get("part_title"),
        "chapter_number": doc.get("chapter_number"),
        "sections": sections,
    }


def _list_chapters(db: Database) -> List[dict]:
    docs = db["chapters"].find({}, {"_id": 0})
    return [_doc_to_chapter_out(doc) for doc in docs]


@router.get("", response_model=List[ChapterOut])
def get_chapters(
    current_user: str = Depends(get_current_user_id), db: Database = Depends(mongo_db)
):
    return _list_chapters(db)


@router.get("/", response_model=List[ChapterOut], include_in_schema=False)
def get_chapters_with_trailing_slash(
    current_user: str = Depends(get_current_user_id), db: Database = Depends(mongo_db)
):
    return _list_chapters(db)


@router.get("/search", response_model=List[ChapterSearchResult])
def search_chapters(
    q: str = Query(..., min_length=1, max_length=120),
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    escaped = re.escape(q.strip())
    if not escaped:
        return []

    pipeline = [
        {
            "$project": {
                "chapter_id": 1,
                "match_count": {
                    "$size": {
                        "$regexFindAll": {
                            "input": {"$ifNull": ["$text", ""]},
                            "regex": escaped,
                            "options": "i",
                        }
                    }
                },
            }
        },
        {"$match": {"match_count": {"$gt": 0}}},
        {
            "$group": {
                "_id": "$chapter_id",
                "occurrence_count": {"$sum": "$match_count"},
            }
        },
        {
            "$lookup": {
                "from": "chapters",
                "let": {"lookup_chapter_id": "$_id"},
                "pipeline": [
                    {
                        "$match": {
                            "$expr": {
                                "$eq": ["$chapter_id", "$$lookup_chapter_id"]
                            }
                        }
                    },
                    {
                        "$project": {
                            "_id": 0,
                            "chapter_id": 1,
                            "title": 1,
                            "chapter_number": 1,
                            "part_number": 1,
                            "part_title": 1,
                        }
                    },
                ],
                "as": "chapter_doc",
            }
        },
        {"$unwind": "$chapter_doc"},
        {
            "$project": {
                "_id": 0,
                "chapter_id": "$chapter_doc.chapter_id",
                "chapter_title": "$chapter_doc.title",
                "chapter_number": "$chapter_doc.chapter_number",
                "part_number": "$chapter_doc.part_number",
                "part_title": "$chapter_doc.part_title",
                "occurrence_count": 1,
            }
        },
        {"$sort": {"occurrence_count": -1, "chapter_number": 1, "chapter_title": 1}},
    ]

    return list(db["text_chunks"].aggregate(pipeline))


@router.get("/{chapter_id}", response_model=ChapterOut)
def get_chapter_by_id(
    chapter_id: str,
    current_user: str = Depends(get_current_user_id),
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
    current_user: str = Depends(get_current_user_id),
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
        db["text_chunks"]
        .find(
            {"chapter_id": chapter_id, "section_id": section_id},
            {"_id": 0, "text": 1, "chunk_index": 1},
        )
        .sort("chunk_index", 1)
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
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    # Fake insert for now
    return {"id": "fake_id", "title": chapter.title, "specialty": chapter.specialty}
