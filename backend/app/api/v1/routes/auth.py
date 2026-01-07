from fastapi import APIRouter, HTTPException, Depends, status
from pymongo.database import Database

from app.schemas.user import UserCreate, UserOut
from app.services.auth_service import register_user, login_user
from app.db.deps import mongo_db
from app.api.deps.auth import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(
    user: UserCreate,
    db: Database = Depends(mongo_db),
):
    try:
        created = register_user(db, user)
        return UserOut(
            id=str(created.id),
            email=created.email,
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Email already registered")


@router.post("/login")
def login(
    user: UserCreate,
    db: Database = Depends(mongo_db),
):
    try:
        token = login_user(db, user.email, user.password)
        return {"access_token": token, "token_type": "bearer"}
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid credentials")


@router.get("/me", response_model=UserOut)
def read_me(current_user=Depends(get_current_user)):
    return UserOut(
        id=str(current_user["_id"]),
        email=current_user["email"],
    )