import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
from bson import ObjectId
from fastapi.testclient import TestClient


MOCK_RAW_CASE = {
    "case_id": "test-case-001",
    "patient_summary": "A 55-year-old with chest pain.",
    "stages": [
        {
            "stage_num": 1,
            "title": "Initial Presentation",
            "revelation": "Patient arrives with chest pain.",
            "available_data": {
                "vitals": "HR 100, BP 140/90",
                "physical_exam": "Clear lungs",
                "labs": "Troponin pending",
                "imaging": "CXR: not ordered",
                "history": "HTN",
            },
            "questions": [
                {
                    "text": "What is the most likely diagnosis?",
                    "model_answer": "NSTEMI",
                    "key_points": ["troponin elevation", "ischemic ECG changes"],
                }
            ],
        },
        {
            "stage_num": 2,
            "title": "Labs Return",
            "revelation": "Troponin comes back elevated.",
            "available_data": {},
            "questions": [
                {
                    "text": "What is the next best step?",
                    "model_answer": "Anticoagulation and cardiology consult",
                    "key_points": ["anticoagulation", "PCI"],
                }
            ],
        },
    ],
}

MOCK_GRADE_RESULT = {
    "score": 8,
    "feedback": "Good answer covering key points.",
    "key_points_covered": ["troponin elevation"],
}


@pytest.fixture
def seeded_session(client, auth_headers, test_db):
    with patch("app.api.v1.routes.stage_b.generate_rolling_case", return_value=MOCK_RAW_CASE):
        resp = client.post(
            "/api/v1/stage-b/sessions/start",
            json={"case_count": 1, "duration_minutes": 45, "difficulty": "medium"},
            headers=auth_headers,
        )
    assert resp.status_code == 200, resp.text
    return resp.json()


def _grade_q0(client, seeded_session, auth_headers):
    sid = seeded_session["session_id"]
    with patch("app.api.v1.routes.stage_b.grade_oral_answer", return_value=MOCK_GRADE_RESULT):
        resp = client.post(
            f"/api/v1/stage-b/sessions/{sid}/answer/0/0/0",
            json={"student_answer": "NSTEMI", "answer_mode": "text"},
            headers=auth_headers,
        )
    assert resp.status_code == 200, resp.text
    return resp


def _finalize(client, seeded_session, auth_headers):
    sid = seeded_session["session_id"]
    resp = client.post(f"/api/v1/stage-b/sessions/{sid}/finalize", headers=auth_headers)
    assert resp.status_code == 200, resp.text
    return resp


class TestStartSession:
    def test_creates_new_session(self, client: TestClient, auth_headers, test_db):
        with patch("app.api.v1.routes.stage_b.generate_rolling_case", return_value=MOCK_RAW_CASE):
            resp = client.post(
                "/api/v1/stage-b/sessions/start",
                json={"case_count": 1, "duration_minutes": 45, "difficulty": "medium"},
                headers=auth_headers,
            )
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "active"
        assert body["case_count"] == 1
        assert body["cases"][0]["stages"][0]["title"] == "Initial Presentation"

    def test_expires_at_has_utc_offset(self, client: TestClient, auth_headers, test_db):
        with patch("app.api.v1.routes.stage_b.generate_rolling_case", return_value=MOCK_RAW_CASE):
            resp = client.post(
                "/api/v1/stage-b/sessions/start",
                json={"case_count": 1, "duration_minutes": 45, "difficulty": "medium"},
                headers=auth_headers,
            )
        assert resp.status_code == 200
        body = resp.json()
        assert "+00:00" in body["expires_at"]
        assert "+00:00" in body["started_at"]

    def test_resumes_active_session(self, client: TestClient, auth_headers, seeded_session):
        with patch("app.api.v1.routes.stage_b.generate_rolling_case", return_value=MOCK_RAW_CASE):
            resp = client.post(
                "/api/v1/stage-b/sessions/start",
                json={"case_count": 1, "duration_minutes": 45, "difficulty": "medium"},
                headers=auth_headers,
            )
        assert resp.status_code == 200
        assert resp.json()["session_id"] == seeded_session["session_id"]

    def test_requires_auth(self, client: TestClient):
        resp = client.post(
            "/api/v1/stage-b/sessions/start",
            json={"case_count": 1, "duration_minutes": 45, "difficulty": "medium"},
        )
        assert resp.status_code == 401


class TestGetActiveSession:
    def test_returns_active_session(self, client: TestClient, auth_headers, seeded_session):
        resp = client.get("/api/v1/stage-b/sessions/active", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["session_id"] == seeded_session["session_id"]

    def test_404_when_no_active_session(self, client: TestClient, auth_headers, test_db):
        resp = client.get("/api/v1/stage-b/sessions/active", headers=auth_headers)
        assert resp.status_code == 404

    def test_expired_session_returns_404_and_marks_expired(
        self, client: TestClient, auth_headers, seeded_session, test_db
    ):
        test_db["stage_b_sessions"].update_one(
            {"session_id": seeded_session["session_id"]},
            {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(minutes=1)}},
        )
        resp = client.get("/api/v1/stage-b/sessions/active", headers=auth_headers)
        assert resp.status_code == 404
        doc = test_db["stage_b_sessions"].find_one({"session_id": seeded_session["session_id"]})
        assert doc["status"] == "expired"


class TestSubmitAnswer:
    def test_happy_path_scores_answer(self, client: TestClient, auth_headers, seeded_session):
        sid = seeded_session["session_id"]
        with patch("app.api.v1.routes.stage_b.grade_oral_answer", return_value=MOCK_GRADE_RESULT):
            resp = client.post(
                f"/api/v1/stage-b/sessions/{sid}/answer/0/0/0",
                json={"student_answer": "NSTEMI", "answer_mode": "text"},
                headers=auth_headers,
            )
        assert resp.status_code == 200
        body = resp.json()
        assert "score" in body
        assert "feedback" in body
        assert body["model_answer"] == "NSTEMI"

    def test_out_of_range_question_num_returns_400(self, client: TestClient, auth_headers, seeded_session):
        sid = seeded_session["session_id"]
        with patch("app.api.v1.routes.stage_b.grade_oral_answer", return_value=MOCK_GRADE_RESULT):
            resp = client.post(
                f"/api/v1/stage-b/sessions/{sid}/answer/0/0/99",
                json={"student_answer": "something", "answer_mode": "text"},
                headers=auth_headers,
            )
        assert resp.status_code == 400

    def test_already_answered_returns_409(self, client: TestClient, auth_headers, seeded_session):
        sid = seeded_session["session_id"]
        with patch("app.api.v1.routes.stage_b.grade_oral_answer", return_value=MOCK_GRADE_RESULT):
            client.post(
                f"/api/v1/stage-b/sessions/{sid}/answer/0/0/0",
                json={"student_answer": "NSTEMI", "answer_mode": "text"},
                headers=auth_headers,
            )
            resp = client.post(
                f"/api/v1/stage-b/sessions/{sid}/answer/0/0/0",
                json={"student_answer": "NSTEMI again", "answer_mode": "text"},
                headers=auth_headers,
            )
        assert resp.status_code == 409

    def test_finalized_session_returns_409(self, client: TestClient, auth_headers, seeded_session):
        sid = seeded_session["session_id"]
        _finalize(client, seeded_session, auth_headers)
        with patch("app.api.v1.routes.stage_b.grade_oral_answer", return_value=MOCK_GRADE_RESULT):
            resp = client.post(
                f"/api/v1/stage-b/sessions/{sid}/answer/0/0/0",
                json={"student_answer": "NSTEMI", "answer_mode": "text"},
                headers=auth_headers,
            )
        assert resp.status_code == 409


class TestAdvanceStage:
    def test_blocks_when_questions_unanswered(self, client: TestClient, auth_headers, seeded_session):
        sid = seeded_session["session_id"]
        resp = client.post(f"/api/v1/stage-b/sessions/{sid}/advance-stage", headers=auth_headers)
        assert resp.status_code == 409
        assert "unanswered" in resp.json()["detail"].lower()

    def test_advances_to_next_stage(self, client: TestClient, auth_headers, seeded_session):
        sid = seeded_session["session_id"]
        _grade_q0(client, seeded_session, auth_headers)
        resp = client.post(f"/api/v1/stage-b/sessions/{sid}/advance-stage", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["current_stage_idx"] == 1


class TestFinalizeSession:
    def test_sets_status_finalized_and_returns_report(self, client: TestClient, auth_headers, seeded_session):
        sid = seeded_session["session_id"]
        resp = client.post(f"/api/v1/stage-b/sessions/{sid}/finalize", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "finalized"
        assert "total_questions" in body
        assert "avg_score" in body
        assert "cases" in body

    def test_idempotent_already_finalized(self, client: TestClient, auth_headers, seeded_session):
        sid = seeded_session["session_id"]
        resp1 = client.post(f"/api/v1/stage-b/sessions/{sid}/finalize", headers=auth_headers)
        resp2 = client.post(f"/api/v1/stage-b/sessions/{sid}/finalize", headers=auth_headers)
        assert resp1.status_code == 200
        assert resp2.status_code == 200
        assert resp2.json()["status"] == "finalized"


class TestGetReport:
    def test_returns_report_for_finalized_session(self, client: TestClient, auth_headers, seeded_session):
        sid = seeded_session["session_id"]
        _finalize(client, seeded_session, auth_headers)
        resp = client.get(f"/api/v1/stage-b/sessions/{sid}/report", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["session_id"] == sid

    def test_409_if_not_finalized(self, client: TestClient, auth_headers, seeded_session):
        sid = seeded_session["session_id"]
        resp = client.get(f"/api/v1/stage-b/sessions/{sid}/report", headers=auth_headers)
        assert resp.status_code == 409


class TestRetakeSession:
    def test_rejects_active_session(self, client: TestClient, auth_headers, seeded_session):
        sid = seeded_session["session_id"]
        resp = client.post(f"/api/v1/stage-b/sessions/{sid}/retake", headers=auth_headers)
        assert resp.status_code == 409

    def test_creates_new_session_with_cleared_answers(self, client: TestClient, auth_headers, seeded_session):
        sid = seeded_session["session_id"]
        _grade_q0(client, seeded_session, auth_headers)
        _finalize(client, seeded_session, auth_headers)
        resp = client.post(f"/api/v1/stage-b/sessions/{sid}/retake", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["session_id"] != sid
        q = body["cases"][0]["stages"][0]["questions"][0]
        assert q["student_answer"] is None
        assert q["score"] is None


class TestListSessions:
    def test_returns_empty_when_no_finalized_sessions(self, client: TestClient, auth_headers, seeded_session):
        resp = client.get("/api/v1/stage-b/sessions", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_returns_finalized_sessions(self, client: TestClient, auth_headers, seeded_session):
        _finalize(client, seeded_session, auth_headers)
        resp = client.get("/api/v1/stage-b/sessions", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert len(body) == 1
        assert body[0]["status"] == "finalized"

    def test_user_isolated(self, client: TestClient, auth_headers, seeded_session, test_db):
        _finalize(client, seeded_session, auth_headers)

        email2 = f"test_{uuid.uuid4().hex[:8]}@example.com"
        password2 = "testpassword123"
        client.post("/api/v1/auth/register", json={"email": email2, "password": password2})
        login_resp = client.post("/api/v1/auth/login", json={"email": email2, "password": password2})
        token2 = login_resp.json()["access_token"]
        headers2 = {"Authorization": f"Bearer {token2}"}

        resp = client.get("/api/v1/stage-b/sessions", headers=headers2)
        assert resp.status_code == 200
        assert resp.json() == []


class TestDeleteSession:
    def test_deletes_finalized_session(self, client: TestClient, auth_headers, seeded_session):
        _finalize(client, seeded_session, auth_headers)
        sid = seeded_session["session_id"]
        resp = client.delete(f"/api/v1/stage-b/sessions/{sid}", headers=auth_headers)
        assert resp.status_code == 204
        # Confirm removed from list
        list_resp = client.get("/api/v1/stage-b/sessions", headers=auth_headers)
        assert list_resp.json() == []

    def test_cannot_delete_active_session(self, client: TestClient, auth_headers, seeded_session):
        sid = seeded_session["session_id"]
        resp = client.delete(f"/api/v1/stage-b/sessions/{sid}", headers=auth_headers)
        assert resp.status_code == 404

    def test_other_user_cannot_delete(self, client: TestClient, auth_headers, seeded_session, test_db):
        _finalize(client, seeded_session, auth_headers)
        sid = seeded_session["session_id"]

        email2 = f"test_{uuid.uuid4().hex[:8]}@example.com"
        client.post("/api/v1/auth/register", json={"email": email2, "password": "testpassword123"})
        login_resp = client.post("/api/v1/auth/login", json={"email": email2, "password": "testpassword123"})
        token2 = login_resp.json()["access_token"]
        headers2 = {"Authorization": f"Bearer {token2}"}

        resp = client.delete(f"/api/v1/stage-b/sessions/{sid}", headers=headers2)
        assert resp.status_code == 404


class TestChatWithExaminer:
    def test_returns_reply(self, client: TestClient, auth_headers, seeded_session):
        sid = seeded_session["session_id"]
        mock_completion = MagicMock()
        mock_completion.choices[0].message.content = "The vitals show HR 100 and BP 140/90."
        with patch("app.api.v1.routes.stage_b.OpenAI") as mock_openai:
            mock_openai.return_value.chat.completions.create.return_value = mock_completion
            resp = client.post(
                f"/api/v1/stage-b/sessions/{sid}/chat/0/0/0",
                json={"message": "What are the vitals?", "history": []},
                headers=auth_headers,
            )
        assert resp.status_code == 200
        assert resp.json()["reply"] == "The vitals show HR 100 and BP 140/90."

    def test_inactive_session_returns_409(self, client: TestClient, auth_headers, seeded_session):
        sid = seeded_session["session_id"]
        _finalize(client, seeded_session, auth_headers)
        mock_completion = MagicMock()
        mock_completion.choices[0].message.content = "some reply"
        with patch("app.api.v1.routes.stage_b.OpenAI") as mock_openai:
            mock_openai.return_value.chat.completions.create.return_value = mock_completion
            resp = client.post(
                f"/api/v1/stage-b/sessions/{sid}/chat/0/0/0",
                json={"message": "What are the vitals?", "history": []},
                headers=auth_headers,
            )
        assert resp.status_code == 409

    def test_invalid_indices_return_400(self, client: TestClient, auth_headers, seeded_session):
        sid = seeded_session["session_id"]
        mock_completion = MagicMock()
        mock_completion.choices[0].message.content = "some reply"
        with patch("app.api.v1.routes.stage_b.OpenAI") as mock_openai:
            mock_openai.return_value.chat.completions.create.return_value = mock_completion
            resp = client.post(
                f"/api/v1/stage-b/sessions/{sid}/chat/0/0/99",
                json={"message": "What are the vitals?", "history": []},
                headers=auth_headers,
            )
        assert resp.status_code == 400


class TestBuildCaseDoc:
    def test_available_data_not_exposed_in_session_out(self, client: TestClient, auth_headers, seeded_session):
        stage = seeded_session["cases"][0]["stages"][0]
        assert "available_data" not in stage

    def test_stem_mapped_from_text(self, client: TestClient, auth_headers, seeded_session):
        q = seeded_session["cases"][0]["stages"][0]["questions"][0]
        assert q["stem"] == "What is the most likely diagnosis?"

    def test_context_mapped_from_revelation(self, client: TestClient, auth_headers, seeded_session):
        stage = seeded_session["cases"][0]["stages"][0]
        assert stage["context"] == "Patient arrives with chest pain."
