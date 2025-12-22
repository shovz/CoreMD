from fastapi import APIRouter

router = APIRouter(
    prefix="/ai",
    tags=["ai"]
)

@router.get("/ask")
def ask_ai(question: str):
    return {"answer": f"AI placeholder response to: {question}"}
