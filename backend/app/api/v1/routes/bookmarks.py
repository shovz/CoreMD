from datetime import datetime, timezone
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from pymongo.database import Database

from app.core.auth import get_current_user
from app.db.deps import mongo_db

router = APIRouter(prefix="/bookmarks", tags=["bookmarks"])


class BookmarkCreate(BaseModel):
    type: str  # "question" | "case"
    item_id: str


@router.post("")
def add_bookmark(
    body: BookmarkCreate,
    current_user: str = Depends(get_current_user),
    db: Database = Depends(mongo_db),
):
    if body.type not in ("question", "case"):
        raise HTTPException(status_code=400, detail="type must be 'question' or 'case'")

    db["bookmarks"].update_one(
        {"user_id": ObjectId(current_user), "item_id": body.item_id},
        {
            "$setOnInsert": {
                "user_id": ObjectId(current_user),
                "type": body.type,
                "item_id": body.item_id,
                "created_at": datetime.now(timezone.utc),
            }
        },
        upsert=True,
    )
    return {"bookmarked": True}


@router.delete("/{item_id}")
def remove_bookmark(
    item_id: str,
    current_user: str = Depends(get_current_user),
    db: Database = Depends(mongo_db),
):
    db["bookmarks"].delete_one({"user_id": ObjectId(current_user), "item_id": item_id})
    return {"bookmarked": False}


@router.get("")
def list_bookmarks(
    type: Optional[str] = Query(None),
    current_user: str = Depends(get_current_user),
    db: Database = Depends(mongo_db),
):
    query: dict = {"user_id": ObjectId(current_user)}
    if type:
        query["type"] = type

    bookmarks = list(db["bookmarks"].find(query, {"_id": 0, "user_id": 0}))

    result: List[dict] = []
    for bm in bookmarks:
        doc: Optional[dict] = None
        if bm["type"] == "question":
            doc = db["questions"].find_one({"question_id": bm["item_id"]}, {"_id": 0})
        elif bm["type"] == "case":
            doc = db["cases"].find_one({"case_id": bm["item_id"]}, {"_id": 0})
        result.append({**bm, "document": doc})

    return result
