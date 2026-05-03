"""
Service-layer unit tests — call service functions directly, no HTTP overhead.
Real MongoDB test DB is used (same CoreMD_test as integration tests).
"""
import uuid
import pytest
from bson import ObjectId
from jose import jwt

from app.core.config import settings
from app.schemas.user import UserCreate
from app.services.auth_service import get_user_by_email, register_user, login_user
from app.services.progress_service import record_progress


def _unique_email() -> str:
    return f"svc_{uuid.uuid4().hex[:8]}@example.com"


class TestGetUserByEmail:
    def test_returns_user_document_when_found(self, test_db):
        email = _unique_email()
        test_db.users.insert_one({"email": email, "hashed_password": "x", "role": "user"})

        doc = get_user_by_email(test_db, email)

        assert doc is not None
        assert doc["email"] == email

    def test_returns_none_for_unknown_email(self, test_db):
        doc = get_user_by_email(test_db, "nobody@example.com")
        assert doc is None


class TestRegisterUser:
    def test_inserts_document_into_db(self, test_db):
        email = _unique_email()
        register_user(test_db, UserCreate(email=email, password="password123"))

        doc = test_db.users.find_one({"email": email})
        assert doc is not None

    def test_hashes_password(self, test_db):
        email = _unique_email()
        register_user(test_db, UserCreate(email=email, password="plaintext"))

        doc = test_db.users.find_one({"email": email})
        assert doc["hashed_password"] != "plaintext"
        assert len(doc["hashed_password"]) > 20  # bcrypt hash is long

    def test_returns_userindb_with_correct_email(self, test_db):
        email = _unique_email()
        user = register_user(test_db, UserCreate(email=email, password="password123"))

        assert user.email == email

    def test_stores_role_as_user_by_default(self, test_db):
        email = _unique_email()
        register_user(test_db, UserCreate(email=email, password="password123"))

        doc = test_db.users.find_one({"email": email})
        assert doc["role"] == "user"


class TestLoginUser:
    def test_returns_valid_jwt_on_correct_credentials(self, test_db):
        email = _unique_email()
        register_user(test_db, UserCreate(email=email, password="correctpassword"))

        token = login_user(test_db, email, "correctpassword")

        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        assert "sub" in payload
        assert ObjectId.is_valid(payload["sub"])

    def test_raises_on_wrong_password(self, test_db):
        email = _unique_email()
        register_user(test_db, UserCreate(email=email, password="correctpassword"))

        with pytest.raises(ValueError, match="Invalid credentials"):
            login_user(test_db, email, "wrongpassword")

    def test_raises_on_unknown_email(self, test_db):
        with pytest.raises(ValueError, match="Invalid credentials"):
            login_user(test_db, "ghost@example.com", "anypassword")


class TestRecordProgress:
    def test_inserts_document_into_db(self, test_db):
        user_id = str(ObjectId())

        class ProgressInput:
            chapter_id = "ch-001"
            question_id = "q-001"
            case_id = None
            is_correct = True
            completed = True

        record_progress(test_db, user_id, ProgressInput())

        doc = test_db.user_progress.find_one({"question_id": "q-001"})
        assert doc is not None
        assert doc["user_id"] == ObjectId(user_id)
        assert doc["is_correct"] is True

    def test_returns_model_with_correct_fields(self, test_db):
        user_id = str(ObjectId())

        class ProgressInput:
            chapter_id = "ch-002"
            question_id = "q-002"
            case_id = "case-001"
            is_correct = False
            completed = False

        result = record_progress(test_db, user_id, ProgressInput())

        assert result.question_id == "q-002"
        assert result.case_id == "case-001"
        assert result.is_correct is False
        assert result.completed is False
        assert result.user_id == ObjectId(user_id)
