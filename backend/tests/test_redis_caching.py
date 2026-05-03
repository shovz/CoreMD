import json
import uuid
import pytest
import redis as redis_lib
from fastapi.testclient import TestClient


QUESTION_SEED = {
    "question_id": "q-cache-001",
    "stem": "Cache test question",
    "options": ["A", "B", "C", "D"],
    "topic": "Cardiology",
    "chapter_id": "ch-cache-001",
    "difficulty": "easy",
    "correct_option": 0,
    "explanation": "A is correct.",
}


@pytest.fixture
def redis_conn():
    r = redis_lib.Redis.from_url("redis://localhost:6379", decode_responses=True)
    yield r
    r.close()


@pytest.fixture(autouse=True)
def seed_question(test_db):
    test_db.questions.delete_many({"question_id": "q-cache-001"})
    test_db.questions.insert_one(QUESTION_SEED)
    yield
    test_db.questions.delete_many({"question_id": "q-cache-001"})
    test_db.question_attempts.delete_many({})


def _headers(client: TestClient) -> dict:
    email = f"rc_{uuid.uuid4().hex[:8]}@example.com"
    client.post("/api/v1/auth/register", json={"email": email, "password": "password123"})
    token = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


class TestStatsCacheWrite:
    def test_overview_key_written_after_first_call(self, client: TestClient, redis_conn):
        headers = _headers(client)
        user_id = client.get("/api/v1/auth/me", headers=headers).json()["id"]

        resp = client.get("/api/v1/stats/overview", headers=headers)
        assert resp.status_code == 200

        assert redis_conn.get(f"stats:overview:{user_id}") is not None

    def test_questions_key_written_after_first_call(self, client: TestClient, redis_conn):
        headers = _headers(client)
        user_id = client.get("/api/v1/auth/me", headers=headers).json()["id"]

        resp = client.get("/api/v1/stats/questions", headers=headers)
        assert resp.status_code == 200

        assert redis_conn.get(f"stats:questions:{user_id}") is not None

    def test_second_call_served_from_redis_not_db(self, client: TestClient, redis_conn):
        headers = _headers(client)
        user_id = client.get("/api/v1/auth/me", headers=headers).json()["id"]

        # First call populates cache
        client.get("/api/v1/stats/overview", headers=headers)

        # Overwrite cache with a sentinel value
        fake = {"total_questions_answered": 999, "correct_percentage": 0.0, "unique_chapters_covered": 0}
        redis_conn.setex(f"stats:overview:{user_id}", 120, json.dumps(fake))

        # Second call must return the cached sentinel, not the real DB value
        resp = client.get("/api/v1/stats/overview", headers=headers)
        assert resp.json()["total_questions_answered"] == 999


class TestStatsCacheInvalidation:
    def test_record_attempt_clears_all_four_stats_keys(self, client: TestClient, redis_conn):
        headers = _headers(client)
        user_id = client.get("/api/v1/auth/me", headers=headers).json()["id"]

        # Populate all four cache keys
        for endpoint in ["overview", "questions", "dashboard", "chapters"]:
            assert client.get(f"/api/v1/stats/{endpoint}", headers=headers).status_code == 200

        for key in ["overview", "questions", "dashboard", "chapters"]:
            assert redis_conn.get(f"stats:{key}:{user_id}") is not None, f"stats:{key} not cached before attempt"

        # Record an attempt — record_attempt deletes all four keys
        attempt_resp = client.post(
            "/api/v1/questions/q-cache-001/attempt",
            json={"selected_option": 0},
            headers=headers,
        )
        assert attempt_resp.status_code == 200

        for key in ["overview", "questions", "dashboard", "chapters"]:
            assert redis_conn.get(f"stats:{key}:{user_id}") is None, f"stats:{key} not invalidated after attempt"

    def test_fresh_data_served_after_invalidation(self, client: TestClient, redis_conn):
        headers = _headers(client)

        # No attempts yet — overview returns 0
        r1 = client.get("/api/v1/stats/overview", headers=headers)
        assert r1.json()["total_questions_answered"] == 0

        # Record an attempt → invalidates cache
        client.post("/api/v1/questions/q-cache-001/attempt", json={"selected_option": 0}, headers=headers)

        # Next call hits DB (cache gone) and returns updated count
        r2 = client.get("/api/v1/stats/overview", headers=headers)
        assert r2.json()["total_questions_answered"] == 1
