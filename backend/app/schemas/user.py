from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=72)  # bcrypt limit


class UserOut(UserBase):
    id: str
    role: str

    class Config:
        orm_mode = True
