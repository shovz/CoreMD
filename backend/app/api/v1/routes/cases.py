from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from pymongo.database import Database

from app.core.auth import get_current_user
from app.schemas.case import CaseListItem, CaseOut
from app.db.deps import mongo_db

router = APIRouter(
    prefix="/cases",
    tags=["cases"]
)


def _doc_to_case_list_item(doc: dict) -> dict:
    return {
        "case_id": doc["case_id"],
        "title": doc["title"],
        "specialty": doc["specialty"],
    }


def _doc_to_case_out(doc: dict) -> dict:
    return {
        "case_id": doc["case_id"],
        "title": doc["title"],
        "specialty": doc["specialty"],
        "presentation": doc["presentation"],
        "history": doc["history"],
        "physical_exam": doc["physical_exam"],
        "labs": doc["labs"],
        "imaging": doc["imaging"],
        "discussion": doc["discussion"],
        "diagnosis": doc["diagnosis"],
        "management": doc["management"],
        "chapter_ref": doc["chapter_ref"],
    }


@router.get("/", response_model=List[CaseListItem])
def get_cases(
    specialty: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(mongo_db),
):
    query: dict = {}
    if specialty:
        query["specialty"] = specialty

    docs = db["cases"].find(query, {"_id": 0})
    return [_doc_to_case_list_item(doc) for doc in docs]


@router.get("/{case_id}", response_model=CaseOut)
def get_case(
    case_id: str,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(mongo_db),
):
    doc = db["cases"].find_one({"case_id": case_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Case not found")
    return _doc_to_case_out(doc)
