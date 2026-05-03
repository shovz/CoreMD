import pytest
from fastapi.testclient import TestClient

TEST_CASE = {
    "case_id": "case-test-001",
    "title": "Chest Pain in a 55-Year-Old",
    "specialty": "Cardiology",
    "presentation": "Sudden onset chest pain radiating to left arm.",
    "history": "Hypertension, dyslipidemia, 20 pack-year smoking history.",
    "physical_exam": "BP 160/95, diaphoretic, S4 gallop.",
    "labs": "Troponin elevated at 2.3 ng/mL.",
    "imaging": "ECG: ST elevation in leads II, III, aVF.",
    "discussion": "Inferior STEMI requiring emergent reperfusion.",
    "diagnosis": "Acute inferior ST-elevation myocardial infarction.",
    "management": "Emergent PCI, dual antiplatelet therapy, heparin.",
    "chapter_id": "ch-001",
}

TEST_CHAPTER = {
    "chapter_id": "ch-001",
    "title": "Ischemic Heart Disease",
    "specialty": "Cardiology",
    "part_number": 7,
    "part_title": "Cardiovascular Disorders",
    "chapter_number": 239,
    "sections": [],
}

TEST_CASE_QUESTION = {
    "case_question_id": "case-q-test-001",
    "case_id": TEST_CASE["case_id"],
    "step": 1,
    "stem": "What is the most likely diagnosis?",
    "options": ["GERD", "Inferior STEMI", "Aortic stenosis", "Pneumonia"],
    "correct_option": 1,
    "explanation": "The ECG and elevated troponin support inferior STEMI.",
}


@pytest.fixture(autouse=True)
def seed_cases(test_db):
    test_db["cases"].insert_one({**TEST_CASE})
    test_db["chapters"].insert_one({**TEST_CHAPTER})
    test_db["case_questions"].insert_one({**TEST_CASE_QUESTION})
    yield


class TestListCases:
    def test_returns_list_with_test_case(self, client: TestClient, auth_headers):
        resp = client.get("/api/v1/cases/", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        ids = [c["case_id"] for c in data]
        assert TEST_CASE["case_id"] in ids

    def test_requires_auth(self, client: TestClient):
        resp = client.get("/api/v1/cases/")
        assert resp.status_code == 401


class TestGetCase:
    def test_returns_full_case_detail(self, client: TestClient, auth_headers):
        resp = client.get(f"/api/v1/cases/{TEST_CASE['case_id']}", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        for field in (
            "case_id", "title", "specialty", "presentation", "history",
            "physical_exam", "labs", "imaging", "discussion", "diagnosis",
            "management", "chapter_id",
        ):
            assert field in data, f"Missing field: {field}"
        assert data["case_id"] == TEST_CASE["case_id"]
        assert data["chapter_title"] == TEST_CHAPTER["title"]

    def test_nonexistent_id_returns_404(self, client: TestClient, auth_headers):
        resp = client.get("/api/v1/cases/nonexistent-case-xyz", headers=auth_headers)
        assert resp.status_code == 404


class TestCaseQuestions:
    def test_list_hides_answer_fields(self, client: TestClient, auth_headers):
        resp = client.get(
            f"/api/v1/cases/{TEST_CASE['case_id']}/questions",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert len(body) == 1
        assert "correct_option" not in body[0]
        assert "explanation" not in body[0]

    def test_attempt_returns_answer_feedback(self, client: TestClient, auth_headers):
        resp = client.post(
            f"/api/v1/cases/{TEST_CASE['case_id']}/questions/{TEST_CASE_QUESTION['case_question_id']}/attempt",
            json={"selected_option": 1},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["correct"] is True
        assert resp.json()["correct_option"] == TEST_CASE_QUESTION["correct_option"]

