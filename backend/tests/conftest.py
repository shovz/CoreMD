import os
import uuid

os.environ["MONGO_URI"] = "mongodb://localhost:27017/CoreMD_test"
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-key")

import pytest
from fastapi.testclient import TestClient
from pymongo import MongoClient

from app.main import app


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def test_db():
    mongo = MongoClient("mongodb://localhost:27017")
    db = mongo["CoreMD_test"]
    yield db
    for name in db.list_collection_names():
        db.drop_collection(name)
    mongo.close()


@pytest.fixture
def auth_headers(client: TestClient, test_db):
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    password = "testpassword123"
    client.post("/api/v1/auth/register", json={"email": email, "password": password})
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
