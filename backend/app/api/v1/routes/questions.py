from fastapi import APIRouter

router = APIRouter(
    prefix="/questions",
    tags=["questions"]
)

@router.get("/")
def get_questions():
    return {"message": "List of questions (placeholder)"}
