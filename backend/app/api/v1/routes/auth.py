from fastapi import APIRouter, HTTPException, Depends, status
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

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
        print("REGISTER endpoint called")

        created = register_user(db, user)
        return UserOut(
            id=str(created.id),
            email=created.email,
            role=created.role,  
        )
    # except Exception as e:
    #     print ('Registration error:', e)
    except DuplicateKeyError:
            # This is the ONLY case we translate to "email already registered"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )



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
        role=current_user.get("role", "user"),
    )