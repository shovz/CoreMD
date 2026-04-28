from datetime import datetime, timezone
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from pymongo.database import Database

from app.core.auth import get_current_user
from app.db.deps import mongo_db

router = APIRouter(prefix="/annotations", tags=["annotations"])


class AnnotationCreate(BaseModel):
    chapter_id: str
    section_id: str
    selected_text: str
    note_text: str


class AnnotationUpdate(BaseModel):
    note_text: str


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "chapter_id": doc["chapter_id"],
        "section_id": doc["section_id"],
        "selected_text": doc["selected_text"],
        "note_text": doc["note_text"],
        "created_at": doc["created_at"],
    }


@router.post("")
def create_annotation(
    body: AnnotationCreate,
    current_user: str = Depends(get_current_user),
    db: Database = Depends(mongo_db),
):
    doc = {
        "user_id": ObjectId(current_user),
        "chapter_id": body.chapter_id,
        "section_id": body.section_id,
        "selected_text": body.selected_text,
        "note_text": body.note_text,
        "created_at": datetime.now(timezone.utc),
    }
    result = db["annotations"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


@router.get("/all")
def get_all_annotations(
    current_user: str = Depends(get_current_user),
    db: Database = Depends(mongo_db),
):
    docs = list(
        db["annotations"]
        .find({"user_id": ObjectId(current_user)})
        .sort("created_at", -1)
    )
    result = []
    for doc in docs:
        chapter_title: Optional[str] = None
        chapter = db["chapters"].find_one({"chapter_id": doc["chapter_id"]}, {"title": 1})
        if chapter:
            chapter_title = chapter.get("title")
        item = _serialize(doc)
        item["chapter_title"] = chapter_title
        result.append(item)
    return result


@router.get("")
def get_annotations(
    chapter_id: str = Query(...),
    current_user: str = Depends(get_current_user),
    db: Database = Depends(mongo_db),
):
    docs = list(
        db["annotations"]
        .find({"user_id": ObjectId(current_user), "chapter_id": chapter_id})
        .sort("created_at", -1)
    )
    return [_serialize(doc) for doc in docs]


@router.patch("/{annotation_id}")
def update_annotation(
    annotation_id: str,
    body: AnnotationUpdate,
    current_user: str = Depends(get_current_user),
    db: Database = Depends(mongo_db),
):
    try:
        oid = ObjectId(annotation_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid annotation ID")

    result = db["annotations"].update_one(
        {"_id": oid, "user_id": ObjectId(current_user)},
        {"$set": {"note_text": body.note_text}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Annotation not found")

    doc = db["annotations"].find_one({"_id": oid})
    return _serialize(doc)


@router.delete("/{annotation_id}")
def delete_annotation(
    annotation_id: str,
    current_user: str = Depends(get_current_user),
    db: Database = Depends(mongo_db),
):
    try:
        oid = ObjectId(annotation_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid annotation ID")

    result = db["annotations"].delete_one({"_id": oid, "user_id": ObjectId(current_user)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Annotation not found")

    return {"deleted": True}
