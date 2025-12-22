from fastapi import APIRouter

router = APIRouter(
    prefix="/cases",
    tags=["cases"]
)

@router.get("/")
def get_cases():
    return {"message": "List of cases (placeholder)"}
