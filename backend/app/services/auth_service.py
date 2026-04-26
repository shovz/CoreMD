from pymongo.database import Database
from app.core.security import hash_password, verify_password
from app.core.jwt import create_access_token
from app.schemas.user import UserCreate
from app.models.user import UserInDB

USERS_COLLECTION = "users"


def get_user_by_email(db: Database, email: str):
    return db[USERS_COLLECTION].find_one({"email": email})


def register_user(db: Database, user_in: UserCreate) -> UserInDB:
    hashed_pw = hash_password(user_in.password)

    user = UserInDB(
        email=user_in.email,
        hashed_password=hashed_pw,
        full_name=user_in.full_name,
    )

    db[USERS_COLLECTION].insert_one(user.to_mongo())
    return user


def login_user(db: Database, email: str, password: str) -> str:
    user = get_user_by_email(db, email)
    if not user:
        raise ValueError("Invalid credentials")

    if not verify_password(password, user["hashed_password"]):
        raise ValueError("Invalid credentials")

    return create_access_token(subject=str(user["_id"]))
