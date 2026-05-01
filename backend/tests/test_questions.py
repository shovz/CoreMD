import pytest
from fastapi.testclient import TestClient


SAMPLE_QUESTIONS = [
    {
        "question_id": "q-test-001",
        "stem": "Which ion is primarily responsible for the resting membrane potential?",
        "options": ["Sodium", "Potassium", "Calcium", "Chloride"],
        "topic": "Physiology",
        "chapter_id": "ch-001",
        "difficulty": "easy",
        "correct_option": 1,
        "explanation": "Potassium leak channels maintain the resting potential near -70 mV.",
    },
    {
        "question_id": "q-test-002",
        "stem": "What is the first-line treatment for community-acquired pneumonia in outpatients?",
        "options": ["Vancomycin", "Amoxicillin", "Ciprofloxacin", "Metronidazole"],
        "topic": "Infectious Disease",
        "chapter_id": "ch-002",
        "difficulty": "medium",
        "correct_option": 1,
        "explanation": "Amoxicillin covers typical organisms and is recommended by IDSA guidelines.",
    },
    {
        "question_id": "q-test-003",
        "stem": "Which organism is the most common cause of lobar pneumonia?",
        "options": ["S. pneumoniae", "Legionella", "Pseudomonas", "Mycoplasma"],
        "topic": "Infectious Disease",
        "chapter_id": "ch-002",
        "difficulty": "medium",
        "correct_option": 0,
        "explanation": "Streptococcus pneumoniae is the most common cause.",
    },
    {
        "question_id": "q-test-004",
        "stem": "What is the preferred outpatient regimen for atypical pneumonia?",
        "options": ["Azithromycin", "Cefepime", "Meropenem", "Linezolid"],
        "topic": "Infectious Disease",
        "chapter_id": "ch-002",
        "difficulty": "hard",
        "correct_option": 0,
        "explanation": "A macrolide is commonly used for atypical coverage.",
    },
]


@pytest.fixture(autouse=True)
def seed_questions(test_db):
    test_db.questions.delete_many({})
    test_db.questions.insert_many(SAMPLE_QUESTIONS)
    test_db.question_followups.delete_many({})
    test_db.question_followups.insert_many(
        [
            {
                "link_id": "q-test-001::correct::02",
                "parent_question_id": "q-test-001",
                "followup_question_id": "q-test-004",
                "trigger": "correct",
                "priority": 2,
            },
            {
                "link_id": "q-test-001::correct::01",
                "parent_question_id": "q-test-001",
                "followup_question_id": "q-test-003",
                "trigger": "correct",
                "priority": 1,
            },
            {
                "link_id": "q-test-001::incorrect::01",
                "parent_question_id": "q-test-001",
                "followup_question_id": "q-test-002",
                "trigger": "incorrect",
                "priority": 1,
            },
        ]
    )
    yield
    test_db.questions.delete_many({})
    test_db.question_attempts.delete_many({})
    test_db.question_followups.delete_many({})


class TestListQuestions:
    def test_returns_list(self, client: TestClient, auth_headers):
        resp = client.get("/api/v1/questions/", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, list)
        assert len(body) == 4

    def test_anti_cheat_fields_absent(self, client: TestClient, auth_headers):
        resp = client.get("/api/v1/questions/", headers=auth_headers)
        assert resp.status_code == 200
        for question in resp.json():
            assert "correct_option" not in question
            assert "explanation" not in question

    def test_requires_auth(self, client: TestClient):
        resp = client.get("/api/v1/questions/")
        assert resp.status_code == 401

    def test_search_filter_matches_stem(self, client: TestClient, auth_headers):
        resp = client.get(
            "/api/v1/questions",
            params={"search": "resting membrane potential"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert len(body) == 1
        assert body[0]["question_id"] == "q-test-001"

    def test_has_followups_filter_returns_only_parent_questions(self, client: TestClient, auth_headers):
        resp = client.get(
            "/api/v1/questions",
            params={"has_followups": "true"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert [question["question_id"] for question in body] == ["q-test-001"]


class TestTopics:
    def test_topics_returns_distinct_sorted_topics(self, client: TestClient, auth_headers):
        resp = client.get("/api/v1/questions/topics", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == ["Infectious Disease", "Physiology"]


class TestGetQuestion:
    def test_returns_correct_option_and_explanation(self, client: TestClient, auth_headers):
        resp = client.get("/api/v1/questions/q-test-001", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["question_id"] == "q-test-001"
        assert "correct_option" in body
        assert "explanation" in body
        assert body["correct_option"] == 1
        assert "Potassium" in body["explanation"]

    def test_not_found(self, client: TestClient, auth_headers):
        resp = client.get("/api/v1/questions/q-nonexistent", headers=auth_headers)
        assert resp.status_code == 404


class TestQuestionFollowups:
    def test_returns_followups_ordered_by_priority_with_safe_fields(self, client: TestClient, auth_headers):
        resp = client.get(
            "/api/v1/questions/q-test-001/followups",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert [item["question_id"] for item in body] == ["q-test-003", "q-test-004"]
        for item in body:
            assert "correct_option" not in item
            assert "explanation" not in item

    def test_trigger_filter_and_limit_are_applied(self, client: TestClient, auth_headers):
        resp = client.get(
            "/api/v1/questions/q-test-001/followups",
            params={"trigger": "incorrect", "limit": 1},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert len(body) == 1
        assert body[0]["question_id"] == "q-test-002"

    def test_not_found_parent_question(self, client: TestClient, auth_headers):
        resp = client.get("/api/v1/questions/q-nonexistent/followups", headers=auth_headers)
        assert resp.status_code == 404


class TestAttemptQuestion:
    def test_correct_answer(self, client: TestClient, auth_headers):
        resp = client.post(
            "/api/v1/questions/q-test-001/attempt",
            json={"selected_option": 1},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["correct"] is True

    def test_wrong_answer(self, client: TestClient, auth_headers):
        resp = client.post(
            "/api/v1/questions/q-test-001/attempt",
            json={"selected_option": 0},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["correct"] is False

    def test_attempt_recorded(self, client: TestClient, auth_headers, test_db):
        client.post(
            "/api/v1/questions/q-test-002/attempt",
            json={"selected_option": 1},
            headers=auth_headers,
        )
        record = test_db.question_attempts.find_one({"question_id": "q-test-002"})
        assert record is not None
        assert record["question_id"] == "q-test-002"
        assert record["is_correct"] is True

