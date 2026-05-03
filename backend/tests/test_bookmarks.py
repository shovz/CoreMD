import uuid

import pytest
from fastapi.testclient import TestClient


def _register_and_login(client: TestClient) -> dict:
    email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    client.post("/api/v1/auth/register", json={"email": email, "password": "testpassword123"})
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": "testpassword123"})
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


SAMPLE_QUESTION = {
    "question_id": "q-bm-001",
    "stem": "What is the most common cause of nephrotic syndrome in adults?",
    "options": ["FSGS", "MCD", "Membranous", "IgA nephropathy"],
    "topic": "Nephrology",
    "chapter_id": "ch-bm-001",
    "difficulty": "medium",
    "correct_option": 2,
    "explanation": "Membranous nephropathy is most common in adults.",
}

SAMPLE_CASE = {
    "case_id": "case-bm-001",
    "title": "Nephrotic Syndrome Case",
    "chapter_id": "ch-bm-001",
}


@pytest.fixture(autouse=True)
def clean_bookmarks(test_db):
    test_db.bookmarks.delete_many({})
    test_db.questions.delete_many({})
    test_db.cases.delete_many({})
    yield
    test_db.bookmarks.delete_many({})
    test_db.questions.delete_many({})
    test_db.cases.delete_many({})


class TestAddBookmark:
    def test_add_question_bookmark(self, client, auth_headers):
        resp = client.post(
            "/api/v1/bookmarks",
            json={"type": "question", "item_id": "q-bm-001"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json() == {"bookmarked": True}

    def test_add_case_bookmark(self, client, auth_headers):
        resp = client.post(
            "/api/v1/bookmarks",
            json={"type": "case", "item_id": "case-bm-001"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json() == {"bookmarked": True}

    def test_invalid_type_returns_400(self, client, auth_headers):
        resp = client.post(
            "/api/v1/bookmarks",
            json={"type": "chapter", "item_id": "ch-bm-001"},
            headers=auth_headers,
        )
        assert resp.status_code == 400

    def test_idempotent_upsert(self, client, auth_headers, test_db):
        payload = {"type": "question", "item_id": "q-bm-001"}
        client.post("/api/v1/bookmarks", json=payload, headers=auth_headers)
        resp = client.post("/api/v1/bookmarks", json=payload, headers=auth_headers)
        assert resp.status_code == 200
        assert test_db.bookmarks.count_documents({}) == 1

    def test_requires_auth(self, client):
        resp = client.post("/api/v1/bookmarks", json={"type": "question", "item_id": "q-001"})
        assert resp.status_code == 401


class TestRemoveBookmark:
    def test_removes_existing(self, client, auth_headers, test_db):
        client.post(
            "/api/v1/bookmarks",
            json={"type": "question", "item_id": "q-bm-001"},
            headers=auth_headers,
        )
        resp = client.delete("/api/v1/bookmarks/q-bm-001", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == {"bookmarked": False}
        assert test_db.bookmarks.count_documents({}) == 0

    def test_remove_nonexistent_is_silent(self, client, auth_headers):
        resp = client.delete("/api/v1/bookmarks/nonexistent-item", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == {"bookmarked": False}


class TestListBookmarks:
    def test_returns_document_for_question(self, client, auth_headers, test_db):
        test_db.questions.insert_one(SAMPLE_QUESTION)
        client.post(
            "/api/v1/bookmarks",
            json={"type": "question", "item_id": "q-bm-001"},
            headers=auth_headers,
        )

        resp = client.get("/api/v1/bookmarks", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["document"] is not None
        assert data[0]["document"]["question_id"] == "q-bm-001"

    def test_null_document_when_item_missing(self, client, auth_headers):
        client.post(
            "/api/v1/bookmarks",
            json={"type": "question", "item_id": "q-does-not-exist"},
            headers=auth_headers,
        )

        resp = client.get("/api/v1/bookmarks", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()[0]["document"] is None

    def test_type_filter(self, client, auth_headers, test_db):
        test_db.questions.insert_one(SAMPLE_QUESTION)
        test_db.cases.insert_one(SAMPLE_CASE)
        client.post(
            "/api/v1/bookmarks",
            json={"type": "question", "item_id": "q-bm-001"},
            headers=auth_headers,
        )
        client.post(
            "/api/v1/bookmarks",
            json={"type": "case", "item_id": "case-bm-001"},
            headers=auth_headers,
        )

        resp = client.get("/api/v1/bookmarks", params={"type": "question"}, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["type"] == "question"

    def test_user_isolation(self, client, auth_headers):
        headers_b = _register_and_login(client)
        client.post(
            "/api/v1/bookmarks",
            json={"type": "question", "item_id": "q-user-a"},
            headers=auth_headers,
        )
        client.post(
            "/api/v1/bookmarks",
            json={"type": "question", "item_id": "q-user-b"},
            headers=headers_b,
        )

        resp_a = client.get("/api/v1/bookmarks", headers=auth_headers)
        resp_b = client.get("/api/v1/bookmarks", headers=headers_b)
        assert len(resp_a.json()) == 1
        assert resp_a.json()[0]["item_id"] == "q-user-a"
        assert len(resp_b.json()) == 1
        assert resp_b.json()[0]["item_id"] == "q-user-b"
