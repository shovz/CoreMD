# Backend Test Suite — Implementation Explained

## 1. What Was Implemented and Why

CoreMD had no automated tests. All 7 API routes and 4 services had been manually verified, but were unprotected against regressions before AWS deployment. This work adds a pytest integration test suite covering the five critical API surface areas: auth, questions, cases, chapters, and stats.

The driving motivation was a real incident: a `$facet` aggregation in the stats endpoint returned lists where the schema expected dicts, causing a 500 error that only surfaced in production. A test suite that runs against a real MongoDB instance (not mocks) would have caught this immediately. That principle — real DB, not mocks — became the foundational design decision for the entire suite.

---

## 2. Key Design Decisions and Reasoning

**Real MongoDB, not mongomock**
All tests run against a live `CoreMD_test` database. This is deliberate: MongoDB aggregation pipelines (`$facet`, `$lookup`, `$group`) behave differently from mock implementations. The stats bug was caught precisely because a real pipeline was used.

**Test isolation via fixture teardown**
A `test_db` fixture yields the test database and drops all test collections after each test. Each test creates its own data, so tests are fully independent and can run in any order without leakage.

**`pytest.ini` env override**
`MONGO_URI` is set to `mongodb://localhost:27017/CoreMD_test` in `pytest.ini`. This is the safety rail: tests can never accidentally write to the production `CoreMD` database regardless of what `.env` says.

**`autouse` index fixtures per module**
When `test_db` teardown drops the `users` collection, MongoDB loses the unique email index with it. Each auth-dependent test module defines an `autouse` fixture that re-creates `create_index("email", unique=True)` before each test. This ensures uniqueness constraints are enforced without relying on persistent DB state.

**Direct DB insertion for fixtures, not API calls**
Test fixtures for questions, cases, and chapters insert documents directly into `test_db` rather than calling the API. This avoids coupling fixture setup to the behavior under test, and allows inserting fields (like `chapter_id` alongside `chapter_ref`) that the API itself doesn't expose.

---

## 3. MongoDB Document Shapes Produced

These are the shapes written by test fixtures. Production documents follow the same shapes.

**`users` collection**
```json
{
  "_id": ObjectId,
  "email": "testuser@example.com",
  "hashed_password": "<bcrypt hash>",
  "role": "user"
}
```

**`questions` collection**
```json
{
  "_id": ObjectId,
  "text": "Question text",
  "options": ["A", "B", "C", "D"],
  "correct_option": 0,
  "explanation": "Explanation text",
  "chapter_ref": "Chapter Name",
  "chapter_id": "chapter-slug",
  "difficulty": "easy",
  "topic": "Cardiology"
}
```
Note: `chapter_id` must be present alongside `chapter_ref` — the stats aggregation pipeline uses `$question.chapter_id` for the `unique_chapters_covered` lookup.

**`question_attempts` collection**
```json
{
  "_id": ObjectId,
  "user_id": ObjectId,
  "question_id": ObjectId,
  "selected_option": 0,
  "is_correct": true,
  "difficulty": "easy",
  "topic": "Cardiology",
  "chapter_id": "chapter-slug",
  "created_at": ISODate
}
```

**`cases` collection**
```json
{
  "_id": ObjectId,
  "title": "Case Title",
  "specialty": "Cardiology",
  "chief_complaint": "...",
  "history": "...",
  "physical_exam": "...",
  "workup": "...",
  "diagnosis": "...",
  "treatment": "...",
  "discussion": "...",
  "created_at": ISODate
}
```

**`chapters` collection**
```json
{
  "_id": ObjectId,
  "chapter_id": "chapter-slug",
  "part_number": 1,
  "part_title": "Part Title",
  "chapter_number": 1,
  "title": "Chapter Title",
  "sections": [
    { "section_id": "s1", "title": "Section Title" }
  ]
}
```

---

## 4. How to Run the Tests

Prerequisites: MongoDB running locally, `CoreMD_test` DB will be created automatically.

```bash
cd backend

# Full suite
pytest tests/

# Individual modules
pytest tests/test_auth.py
pytest tests/test_questions.py
pytest tests/test_stats.py
pytest tests/test_cases.py
pytest tests/test_chapters.py
```

The suite targets `CoreMD_test` via `pytest.ini` — no manual env configuration needed. Full suite runtime is under 60 seconds.

---

## 5. Files Changed and What Each Does

| File | Change | Purpose |
|------|--------|---------|
| `backend/requirements.txt` | Added `pytest`, `httpx`, `pytest-asyncio` | Test runner and async HTTP client for `TestClient` |
| `backend/pytest.ini` | Created | Sets `testpaths = tests`, overrides `MONGO_URI` to `CoreMD_test` |
| `backend/tests/__init__.py` | Created (empty) | Makes `tests/` a Python package |
| `backend/tests/conftest.py` | Created | Shared fixtures: `client` (TestClient), `test_db` (real MongoDB + teardown), `auth_headers` (registers + logs in a fresh user, returns Bearer token dict) |
| `backend/tests/test_auth.py` | Created | 7 tests covering register (happy path, duplicate email, short password), login (valid, wrong password), and `/me` (valid token, missing token). Includes `autouse` fixture to re-create the unique email index after teardown. |
| `backend/tests/test_questions.py` | Created | Tests list endpoint (anti-cheat: `correct_option`/`explanation` absent), detail endpoint (fields present), auth guard (401 without token), and attempt recording (correct/wrong, persisted to `question_attempts`). |
| `backend/tests/test_stats.py` | Created | Inserts 3 attempts (2 correct easy, 1 wrong medium). Asserts `by_difficulty` is a **dict** (not list), verifies `correct_percentage`, `unique_chapters_covered`, `by_topic` shape, and zero-state (no attempts → zeroed values, no 500). |
| `backend/tests/test_cases.py` | Created | Smoke tests: list (auth required), detail (all 8 fields present), 404 on nonexistent ID. |
| `backend/tests/test_chapters.py` | Created | Smoke tests: list (auth required), detail (`part_number`, `part_title`, `chapter_number` present), 404 on nonexistent ID. |
| `backend/app/api/v1/routes/auth.py` | Bug fix | `GET /auth/me` was missing `role` in the `UserOut` response. Added `role=current_user.get("role", "user")` — the field is required by the schema and would 500 without it. |

---

## 6. Key Learnings from Implementation

**`$facet` returns lists, not dicts**
MongoDB's `$facet` stage always yields grouped results as arrays. If a Pydantic schema declares `Dict[str, Model]`, the service layer must explicitly transform the list to a dict after the aggregation. The stats test for `by_difficulty` being a dict (not a list) is the regression guard for this exact bug.

**Index loss on collection drop**
Dropping a MongoDB collection in teardown removes all indexes, including unique constraints. Any test that relies on a `unique=True` index must re-create it before running, not assume it persists from the previous test.

**`chapter_id` vs `chapter_ref`**
Chapter documents use `chapter_id` as the canonical field name for lookups. The question document stores both `chapter_ref` (display name) and `chapter_id` (slug for aggregation joins). The stats pipeline uses `chapter_id` — fixtures must include it even though the question creation API only stores `chapter_ref`.

**`UserOut.role` was a latent bug**
The `/auth/me` route was constructing `UserOut` without passing `role`. Because `role` is a required field in the schema, this silently failed in some code paths. The auth tests exposed it immediately.

**`pydantic[email]` not bare `pydantic`**
When any Pydantic schema uses `EmailStr`, `pydantic[email]` must be in `requirements.txt`. Bare `pydantic` will raise a runtime error at startup.

**Module-scoped `autouse` fixtures beat conftest for per-suite seeding**
Seeding data in `conftest.py` applies globally. For per-suite setup (e.g., inserting a chapter only for chapter tests), an `autouse` fixture scoped to the test module is cleaner and avoids polluting other test suites.
