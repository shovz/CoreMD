from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from pymongo.database import Database

from app.core.auth import get_current_user
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
    }


def _doc_to_case_out(doc: dict, chapter_title: Optional[str] = None) -> dict:
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
        "chapter_title": chapter_title,
    }


@router.get("", response_model=List[CaseListItem])
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

    chapter_title: Optional[str] = None
    chapter_ref = doc.get("chapter_ref")
    if chapter_ref:
        ch = db["chapters"].find_one({"chapter_id": chapter_ref}, {"_id": 0, "title": 1})
        if ch:
            chapter_title = ch["title"]

    return _doc_to_case_out(doc, chapter_title)


@router.get("/{case_id}/questions", response_model=List[CaseQuestionOut])
def get_case_questions(
    case_id: str,
    current_user: dict = Depends(get_current_user),
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
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(mongo_db),
):
    doc = db["case_questions"].find_one(
        {"case_question_id": question_id, "case_id": case_id}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Case question not found")

    return {
        "correct": attempt.selected_option == doc["correct_option"],
        "correct_option": doc["correct_option"],
        "explanation": doc["explanation"],
    }
