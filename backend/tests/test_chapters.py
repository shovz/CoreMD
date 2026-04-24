import pytest
from fastapi.testclient import TestClient

TEST_CHAPTER = {
    "chapter_id": "ch-test-001",
    "title": "Approach to the Patient with Respiratory Disease",
    "specialty": "Pulmonology",
    "part_number": 10,
    "part_title": "Disorders of the Respiratory System",
    "chapter_number": 279,
    "sections": [
        {"id": "sec-001", "title": "History and Physical Examination"},
        {"id": "sec-002", "title": "Diagnostic Studies"},
    ],
}

SECOND_CHAPTER = {
    "chapter_id": "ch-test-002",
    "title": "Principles of Cardiology",
    "specialty": "Cardiology",
    "part_number": 5,
    "part_title": "Cardiovascular Disorders",
    "chapter_number": 120,
    "sections": [{"id": "sec-101", "title": "Heart Failure"}],
}


@pytest.fixture(autouse=True)
def seed_chapters(test_db):
    test_db["chapters"].insert_many([{**TEST_CHAPTER}, {**SECOND_CHAPTER}])
    test_db["text_chunks"].insert_many(
        [
            {
                "chapter_id": TEST_CHAPTER["chapter_id"],
                "section_id": "sec-001",
                "chunk_index": 0,
                "text": "Respiratory failure respiratory distress with respiratory acidosis.",
            },
            {
                "chapter_id": TEST_CHAPTER["chapter_id"],
                "section_id": "sec-002",
                "chunk_index": 1,
                "text": "Respiratory exam and imaging findings.",
            },
            {
                "chapter_id": SECOND_CHAPTER["chapter_id"],
                "section_id": "sec-101",
                "chunk_index": 0,
                "text": "Cardiac output and blood pressure management.",
            },
        ]
    )
    yield


class TestListChapters:
    def test_returns_list(self, client: TestClient, auth_headers):
        resp = client.get("/api/v1/chapters/", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        ids = [c["id"] for c in data]
        assert TEST_CHAPTER["chapter_id"] in ids

    def test_requires_auth(self, client: TestClient):
        resp = client.get("/api/v1/chapters/")
        assert resp.status_code == 401


class TestGetChapter:
    def test_returns_chapter_with_required_fields(self, client: TestClient, auth_headers):
        resp = client.get(
            f"/api/v1/chapters/{TEST_CHAPTER['chapter_id']}", headers=auth_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["part_number"] == TEST_CHAPTER["part_number"]
        assert data["part_title"] == TEST_CHAPTER["part_title"]
        assert data["chapter_number"] == TEST_CHAPTER["chapter_number"]
        assert data["id"] == TEST_CHAPTER["chapter_id"]
        assert len(data["sections"]) == 2

    def test_nonexistent_id_returns_404(self, client: TestClient, auth_headers):
        resp = client.get("/api/v1/chapters/nonexistent-chapter-xyz", headers=auth_headers)
        assert resp.status_code == 404


class TestSearchChapters:
    def test_requires_auth(self, client: TestClient):
        resp = client.get("/api/v1/chapters/search?q=respiratory")
        assert resp.status_code == 401

    def test_returns_ranked_occurrence_counts(self, client: TestClient, auth_headers):
        resp = client.get("/api/v1/chapters/search?q=respiratory", headers=auth_headers)
        assert resp.status_code == 200

        data = resp.json()
        assert len(data) == 1
        top = data[0]
        assert top["chapter_id"] == TEST_CHAPTER["chapter_id"]
        assert top["chapter_title"] == TEST_CHAPTER["title"]
        assert top["occurrence_count"] == 4

    def test_returns_empty_for_no_match(self, client: TestClient, auth_headers):
        resp = client.get("/api/v1/chapters/search?q=nephrotic", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == []
