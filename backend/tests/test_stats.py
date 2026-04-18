import uuid
import pytest
from fastapi.testclient import TestClient


QUESTION_EASY = {
    "question_id": "q-stats-001",
    "stem": "Easy stats test question",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "topic": "Cardiology",
    "chapter_ref": "ch-stats-001",
    "chapter_id": "ch-stats-001",
    "difficulty": "easy",
    "correct_option": 0,
    "explanation": "Option A is correct.",
}

QUESTION_MEDIUM = {
    "question_id": "q-stats-002",
    "stem": "Medium stats test question",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "topic": "Cardiology",
    "chapter_ref": "ch-stats-001",
    "chapter_id": "ch-stats-001",
    "difficulty": "medium",
    "correct_option": 0,
    "explanation": "Option A is correct.",
}


@pytest.fixture(autouse=True)
def seed_stats_questions(test_db):
    test_db.users.create_index("email", unique=True)
    test_db.questions.delete_many({"question_id": {"$in": ["q-stats-001", "q-stats-002"]}})
    test_db.questions.insert_many([QUESTION_EASY, QUESTION_MEDIUM])
    yield
    test_db.questions.delete_many({"question_id": {"$in": ["q-stats-001", "q-stats-002"]}})
    test_db.question_attempts.delete_many({})


def _register_and_login(client: TestClient):
    email = f"stats_{uuid.uuid4().hex[:8]}@example.com"
    password = "statspassword123"
    client.post("/api/v1/auth/register", json={"email": email, "password": password})
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def stats_headers(client: TestClient):
    """Fresh user with 2 correct easy attempts + 1 wrong medium attempt."""
    headers = _register_and_login(client)
    client.post("/api/v1/questions/q-stats-001/attempt", json={"selected_option": 0}, headers=headers)
    client.post("/api/v1/questions/q-stats-001/attempt", json={"selected_option": 0}, headers=headers)
    client.post("/api/v1/questions/q-stats-002/attempt", json={"selected_option": 1}, headers=headers)
    return headers


@pytest.fixture
def empty_headers(client: TestClient):
    """Fresh user with no attempts."""
    return _register_and_login(client)


class TestOverviewStats:
    def test_correct_totals(self, client: TestClient, stats_headers):
        resp = client.get("/api/v1/stats/overview", headers=stats_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["total_questions_answered"] == 3
        assert abs(body["correct_percentage"] - (2 / 3 * 100)) < 0.01
        assert body["unique_chapters_covered"] == 1

    def test_empty_state_returns_zeros_not_500(self, client: TestClient, empty_headers):
        resp = client.get("/api/v1/stats/overview", headers=empty_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["total_questions_answered"] == 0
        assert body["correct_percentage"] == 0
        assert body["unique_chapters_covered"] == 0


class TestQuestionStats:
    def test_by_difficulty_is_dict(self, client: TestClient, stats_headers):
        resp = client.get("/api/v1/stats/questions", headers=stats_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json()["by_difficulty"], dict)

    def test_by_difficulty_easy(self, client: TestClient, stats_headers):
        body = client.get("/api/v1/stats/questions", headers=stats_headers).json()
        assert "easy" in body["by_difficulty"]
        easy = body["by_difficulty"]["easy"]
        assert easy["attempted"] == 2
        assert easy["accuracy"] == 100.0

    def test_by_difficulty_medium(self, client: TestClient, stats_headers):
        body = client.get("/api/v1/stats/questions", headers=stats_headers).json()
        assert "medium" in body["by_difficulty"]
        medium = body["by_difficulty"]["medium"]
        assert medium["attempted"] == 1
        assert medium["accuracy"] == 0.0

    def test_by_topic_is_list(self, client: TestClient, stats_headers):
        resp = client.get("/api/v1/stats/questions", headers=stats_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json()["by_topic"], list)

    def test_empty_state_returns_zeros_not_500(self, client: TestClient, empty_headers):
        resp = client.get("/api/v1/stats/questions", headers=empty_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["by_difficulty"] == {}
        assert body["by_topic"] == []
