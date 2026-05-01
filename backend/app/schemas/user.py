from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr


class UserLogin(UserBase):
    password: str


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=72)  # bcrypt limit
    full_name: str = ""


class UserOut(UserBase):
    id: str
    role: str
    full_name: str = ""

    class Config:
        orm_mode = True
