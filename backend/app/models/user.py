from datetime import datetime
from typing import Optional
from pydantic import EmailStr
from bson import ObjectId

class UserInDB:
    def __init__(
        self,
        email: EmailStr,
        hashed_password: str,
        role: str = "user",
        full_name: str = "",
        created_at: Optional[datetime] = None,
        _id: Optional[ObjectId] = None,
    ):
        self.id = _id or ObjectId()
        self.email = email
        self.hashed_password = hashed_password
        self.role = role
        self.full_name = full_name
        self.created_at = created_at or datetime.utcnow()

    def to_mongo(self) -> dict:
        return {
            "_id": self.id,
            "email": self.email,
            "hashed_password": self.hashed_password,
            "role": self.role,
            "full_name": self.full_name,
            "created_at": self.created_at,
        }
