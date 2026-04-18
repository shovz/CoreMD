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
    "chapter_ref": "ch-001",
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


@pytest.fixture(autouse=True)
def seed_cases(test_db):
    test_db["cases"].insert_one({**TEST_CASE})
    test_db["chapters"].insert_one({**TEST_CHAPTER})
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
            "management", "chapter_ref",
        ):
            assert field in data, f"Missing field: {field}"
        assert data["case_id"] == TEST_CASE["case_id"]
        assert data["chapter_title"] == TEST_CHAPTER["title"]

    def test_nonexistent_id_returns_404(self, client: TestClient, auth_headers):
        resp = client.get("/api/v1/cases/nonexistent-case-xyz", headers=auth_headers)
        assert resp.status_code == 404
