import uuid

import pytest
from fastapi.testclient import TestClient


def _register_and_login(client: TestClient) -> dict:
    email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    client.post("/api/v1/auth/register", json={"email": email, "password": "testpassword123"})
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": "testpassword123"})
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


@pytest.fixture(autouse=True)
def clean_annotations(test_db):
    test_db.annotations.delete_many({})
    test_db.chapters.delete_many({})
    yield
    test_db.annotations.delete_many({})
    test_db.chapters.delete_many({})


ANNOTATION_PAYLOAD = {
    "chapter_id": "ch-ann-001",
    "section_id": "sec-ann-001",
    "selected_text": "The mitral valve has two leaflets.",
    "note_text": "Remember for boards",
}


class TestCreateAnnotation:
    def test_happy_path(self, client, auth_headers):
        resp = client.post("/api/v1/annotations", json=ANNOTATION_PAYLOAD, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "id" in data
        assert data["chapter_id"] == ANNOTATION_PAYLOAD["chapter_id"]
        assert data["section_id"] == ANNOTATION_PAYLOAD["section_id"]
        assert data["selected_text"] == ANNOTATION_PAYLOAD["selected_text"]
        assert data["note_text"] == ANNOTATION_PAYLOAD["note_text"]
        assert "created_at" in data

    def test_highlight_no_note(self, client, auth_headers):
        payload = {**ANNOTATION_PAYLOAD, "note_text": ""}
        resp = client.post("/api/v1/annotations", json=payload, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["note_text"] == ""

    def test_requires_auth(self, client):
        resp = client.post("/api/v1/annotations", json=ANNOTATION_PAYLOAD)
        assert resp.status_code == 401


class TestGetAnnotationsByChapter:
    def test_user_isolation(self, client, auth_headers, test_db):
        headers_b = _register_and_login(client)
        payload = {**ANNOTATION_PAYLOAD, "chapter_id": "ch-shared"}
        client.post("/api/v1/annotations", json=payload, headers=auth_headers)
        client.post("/api/v1/annotations", json=payload, headers=headers_b)

        resp = client.get("/api/v1/annotations", params={"chapter_id": "ch-shared"}, headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_requires_chapter_id(self, client, auth_headers):
        resp = client.get("/api/v1/annotations", headers=auth_headers)
        assert resp.status_code == 422

    def test_empty_list(self, client, auth_headers):
        resp = client.get("/api/v1/annotations", params={"chapter_id": "ch-empty"}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == []


class TestGetAllAnnotations:
    def test_includes_chapter_title(self, client, auth_headers, test_db):
        test_db.chapters.insert_one({"chapter_id": "ch-ann-001", "title": "Cardiology Basics"})
        client.post("/api/v1/annotations", json=ANNOTATION_PAYLOAD, headers=auth_headers)

        resp = client.get("/api/v1/annotations/all", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["chapter_title"] == "Cardiology Basics"

    def test_null_title_when_chapter_missing(self, client, auth_headers):
        client.post("/api/v1/annotations", json=ANNOTATION_PAYLOAD, headers=auth_headers)

        resp = client.get("/api/v1/annotations/all", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()[0]["chapter_title"] is None


class TestUpdateAnnotation:
    def test_updates_note_text(self, client, auth_headers):
        create_resp = client.post("/api/v1/annotations", json=ANNOTATION_PAYLOAD, headers=auth_headers)
        annotation_id = create_resp.json()["id"]

        resp = client.patch(
            f"/api/v1/annotations/{annotation_id}",
            json={"note_text": "Updated note"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["note_text"] == "Updated note"

    def test_other_users_returns_404(self, client, auth_headers):
        headers_b = _register_and_login(client)
        create_resp = client.post("/api/v1/annotations", json=ANNOTATION_PAYLOAD, headers=auth_headers)
        annotation_id = create_resp.json()["id"]

        resp = client.patch(
            f"/api/v1/annotations/{annotation_id}",
            json={"note_text": "Hijacked"},
            headers=headers_b,
        )
        assert resp.status_code == 404

    def test_invalid_id_returns_400(self, client, auth_headers):
        resp = client.patch(
            "/api/v1/annotations/not-a-valid-objectid",
            json={"note_text": "x"},
            headers=auth_headers,
        )
        assert resp.status_code == 400


class TestDeleteAnnotation:
    def test_deletes_own(self, client, auth_headers):
        create_resp = client.post("/api/v1/annotations", json=ANNOTATION_PAYLOAD, headers=auth_headers)
        annotation_id = create_resp.json()["id"]

        resp = client.delete(f"/api/v1/annotations/{annotation_id}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == {"deleted": True}

        list_resp = client.get(
            "/api/v1/annotations",
            params={"chapter_id": ANNOTATION_PAYLOAD["chapter_id"]},
            headers=auth_headers,
        )
        assert list_resp.json() == []

    def test_other_users_returns_404(self, client, auth_headers):
        headers_b = _register_and_login(client)
        create_resp = client.post("/api/v1/annotations", json=ANNOTATION_PAYLOAD, headers=auth_headers)
        annotation_id = create_resp.json()["id"]

        resp = client.delete(f"/api/v1/annotations/{annotation_id}", headers=headers_b)
        assert resp.status_code == 404

    def test_invalid_id_returns_400(self, client, auth_headers):
        resp = client.delete("/api/v1/annotations/not-a-valid-objectid", headers=auth_headers)
        assert resp.status_code == 400
