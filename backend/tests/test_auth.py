import uuid
import pytest
from fastapi.testclient import TestClient


def unique_email() -> str:
    return f"test_{uuid.uuid4().hex[:8]}@example.com"


@pytest.fixture(autouse=True)
def ensure_email_index(test_db):
    # Recreate unique index after each prior test may have dropped the collection
    test_db.users.create_index("email", unique=True)


class TestRegister:
    def test_happy_path(self, client: TestClient):
        resp = client.post(
            "/api/v1/auth/register",
            json={"email": unique_email(), "password": "password123"},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert "id" in body
        assert "email" in body
        assert "role" in body

    def test_duplicate_email(self, client: TestClient):
        email = unique_email()
        client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "password123"},
        )
        resp = client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "password123"},
        )
        assert resp.status_code == 400

    def test_short_password(self, client: TestClient):
        resp = client.post(
            "/api/v1/auth/register",
            json={"email": unique_email(), "password": "short"},
        )
        assert resp.status_code == 422


class TestLogin:
    def test_valid_credentials(self, client: TestClient):
        email = unique_email()
        password = "password123"
        client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": password},
        )
        resp = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": password},
        )
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    def test_wrong_password(self, client: TestClient):
        email = unique_email()
        client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "correct_password"},
        )
        resp = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "wrong_password"},
        )
        assert resp.status_code == 401


class TestMe:
    def test_valid_token(self, client: TestClient, auth_headers):
        resp = client.get("/api/v1/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert "id" in body
        assert "email" in body

    def test_missing_token(self, client: TestClient):
        resp = client.get("/api/v1/auth/me")
        assert resp.status_code == 401
