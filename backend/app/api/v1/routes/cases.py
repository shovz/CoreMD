from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timezone
from pymongo.database import Database
from bson import ObjectId
from pydantic import BaseModel

from app.core.auth import get_current_user_id
from app.schemas.case import CaseListItem, CaseOut
from app.schemas.case_question import CaseQuestionOut, CaseAttemptCreate, CaseAttemptResult
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
        "presentation": doc.get("presentation", ""),
    }


def _doc_to_case_out(doc: dict, chapter_title: Optional[str] = None) -> dict:
    chapter_id = doc.get("chapter_id") or doc.get("chapter_ref")
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
        "chapter_id": chapter_id,
        "chapter_title": chapter_title,
    }


def _get_cases(specialty: Optional[str], db: Database):
    query: dict = {}
    if specialty:
        query["specialty"] = specialty
    docs = db["cases"].find(query, {"_id": 0})
    return [_doc_to_case_list_item(doc) for doc in docs]


@router.get("", response_model=List[CaseListItem])
def get_cases(
    specialty: Optional[str] = Query(None),
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    return _get_cases(specialty, db)


@router.get("/", response_model=List[CaseListItem], include_in_schema=False)
def get_cases_slash(
    specialty: Optional[str] = Query(None),
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    return _get_cases(specialty, db)


# --- History models ---

class CaseAttemptHistoryItem(BaseModel):
    attempt_id: str
    case_id: str
    case_title: str
    question_id: str
    selected_option: int
    correct_option: int
    is_correct: bool
    created_at: datetime


class CaseAttemptHistoryResponse(BaseModel):
    items: List[CaseAttemptHistoryItem]
    total: int


class CaseDeleteHistoryResponse(BaseModel):
    deleted_count: int


class CaseSelectiveDeleteRequest(BaseModel):
    case_ids: List[str]


# --- History endpoints (must be before /{case_id}) ---

@router.get("/history", response_model=CaseAttemptHistoryResponse)
def get_case_history(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    user_oid = ObjectId(current_user)
    query = {"user_id": user_oid}
    total = db["case_attempts"].count_documents(query)
    attempts = list(
        db["case_attempts"]
        .find(query)
        .sort("created_at", -1)
        .skip(offset)
        .limit(limit)
    )
    items = [
        CaseAttemptHistoryItem(
            attempt_id=str(a["_id"]),
            case_id=a["case_id"],
            case_title=a.get("case_title", ""),
            question_id=a["question_id"],
            selected_option=a["selected_option"],
            correct_option=a["correct_option"],
            is_correct=a["is_correct"],
            created_at=a["created_at"],
        )
        for a in attempts
    ]
    return CaseAttemptHistoryResponse(items=items, total=total)


@router.delete("/history", response_model=CaseDeleteHistoryResponse)
def delete_case_history(
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    result = db["case_attempts"].delete_many({"user_id": ObjectId(current_user)})
    return CaseDeleteHistoryResponse(deleted_count=result.deleted_count)


@router.delete("/history/selected", response_model=CaseDeleteHistoryResponse)
def delete_case_history_selected(
    body: CaseSelectiveDeleteRequest,
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    result = db["case_attempts"].delete_many(
        {"user_id": ObjectId(current_user), "case_id": {"$in": body.case_ids}}
    )
    return CaseDeleteHistoryResponse(deleted_count=result.deleted_count)


# --- Case detail endpoints ---

@router.get("/{case_id}", response_model=CaseOut)
def get_case(
    case_id: str,
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    doc = db["cases"].find_one({"case_id": case_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Case not found")

    chapter_title: Optional[str] = None
    chapter_id = doc.get("chapter_id") or doc.get("chapter_ref")
    if chapter_id:
        ch = db["chapters"].find_one({"chapter_id": chapter_id}, {"_id": 0, "title": 1})
        if ch:
            chapter_title = ch["title"]

    return _doc_to_case_out(doc, chapter_title)


@router.get("/{case_id}/questions", response_model=List[CaseQuestionOut])
def get_case_questions(
    case_id: str,
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    docs = db["case_questions"].find({"case_id": case_id}, {"_id": 0}).sort("step", 1)
    return [
        {
            "case_question_id": doc["case_question_id"],
            "case_id": doc["case_id"],
            "step": doc["step"],
            "stem": doc["stem"],
            "options": doc["options"],
            "correct_option": doc["correct_option"],
            "explanation": doc["explanation"],
        }
        for doc in docs
    ]


@router.post("/{case_id}/questions/{question_id}/attempt", response_model=CaseAttemptResult)
def attempt_case_question(
    case_id: str,
    question_id: str,
    attempt: CaseAttemptCreate,
    current_user: str = Depends(get_current_user_id),
    db: Database = Depends(mongo_db),
):
    doc = db["case_questions"].find_one(
        {"case_question_id": question_id, "case_id": case_id}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Case question not found")

    is_correct = attempt.selected_option == doc["correct_option"]

    case_doc = db["cases"].find_one({"case_id": case_id}, {"_id": 0, "title": 1})
    case_title = case_doc["title"] if case_doc else ""

    db["case_attempts"].insert_one({
        "user_id": ObjectId(current_user),
        "case_id": case_id,
        "question_id": question_id,
        "selected_option": attempt.selected_option,
        "correct_option": doc["correct_option"],
        "is_correct": is_correct,
        "case_title": case_title,
        "created_at": datetime.now(timezone.utc),
    })

    return {
        "correct": is_correct,
        "correct_option": doc["correct_option"],
        "explanation": doc["explanation"],
    }
