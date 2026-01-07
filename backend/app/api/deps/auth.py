from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pymongo.database import Database
from bson import ObjectId

from app.core.jwt import decode_access_token
from app.db.deps import mongo_db

# HTTP Bearer security scheme
# Expects: Authorization: Bearer <token>
security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Database = Depends(mongo_db),
):
    """
    Dependency that:
    1. Extracts JWT from Authorization header
    2. Decodes & validates the token
    3. Extracts user ID from `sub`
    4. Loads user from MongoDB
    """

    # 1️⃣ No Authorization header
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    # 2️⃣ Extract raw JWT string
    token = credentials.credentials

    # 3️⃣ Decode & validate JWT
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    # 4️⃣ Extract user id from JWT subject
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    # 5️⃣ Load user from MongoDB
    user = db.users.find_one({"_id": ObjectId(user_id)})
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # 6️⃣ Return Mongo user document
    return user
