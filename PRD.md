# PRD: Backend Test Suite

## Introduction

CoreMD has no automated tests. The 7 API routes and 4 services have been manually
verified but are unprotected against regressions. Before AWS deployment, the critical
paths — auth, questions, cases, stats, and the AI endpoint — need a pytest suite that
runs against a real (test) MongoDB instance so schema mismatches and aggregation bugs
are caught early.

## Goals

- pytest integration test suite covering all critical API routes
- Tests run against a real MongoDB test database (not mocks) — same pattern that caught
  the $facet/schema mismatch in stats
- Each test is self-contained: creates its own data, cleans up after itself
- Full suite runs in under 60 seconds
- `pytest` and `httpx` added to requirements

## User Stories

### US-001: Test infrastructure
**Description:** As a developer, I need the test scaffolding (conftest, fixtures,
test DB) so individual test files can focus on business logic.

**Acceptance Criteria:**
- [x] `pytest`, `httpx`, `pytest-asyncio` added to `backend/requirements.txt`
- [x] `backend/tests/__init__.py` created (empty)
- [x] `backend/tests/conftest.py` created with:
  - `client` fixture: `TestClient` wrapping the FastAPI app
  - `test_db` fixture: connects to `CoreMD_test` database, yields db, drops all
    test collections after each test
  - `auth_headers` fixture: registers + logs in a fresh test user, returns
    `{"Authorization": "Bearer <token>"}` dict
- [x] `backend/pytest.ini` (or `pyproject.toml` `[tool.pytest]` section) sets
  `testpaths = tests` and `MONGO_URI=mongodb://localhost:27017/CoreMD_test`
  so tests never touch the real `CoreMD` database
- [x] `pytest tests/` runs with 0 errors (no test files yet, just scaffolding)
- [x] Typecheck passes

### US-002: Auth route tests
**Description:** As a developer, I need tests for register and login so auth
regressions are caught immediately.

**Acceptance Criteria:**
- [x] `backend/tests/test_auth.py` created
- [x] `POST /api/v1/auth/register` — happy path returns 201 with `id`, `email`, `role`
- [x] `POST /api/v1/auth/register` — duplicate email returns 400
- [x] `POST /api/v1/auth/register` — password shorter than 8 chars returns 422
- [x] `POST /api/v1/auth/login` — valid credentials returns 200 with `access_token`
- [x] `POST /api/v1/auth/login` — wrong password returns 401
- [x] `GET /api/v1/auth/me` — valid token returns current user; missing token returns 401
- [x] All tests pass: `pytest tests/test_auth.py`

### US-003: Questions and attempt tests
**Description:** As a developer, I need tests for the question bank so the
anti-cheat filter and attempt recording are verified.

**Acceptance Criteria:**
- [x] `backend/tests/test_questions.py` created
- [x] Fixture inserts 2 test questions directly into `test_db`
- [x] `GET /api/v1/questions/` — returns list; `correct_option` and `explanation`
  NOT present in list response (anti-cheat)
- [x] `GET /api/v1/questions/{id}` — returns single question WITH `correct_option`
  and `explanation`
- [x] `GET /api/v1/questions/` — requires auth, returns 401 without token
- [x] `POST /api/v1/questions/{id}/attempt` — correct answer returns
  `{"is_correct": true}`, wrong answer returns `{"is_correct": false}`
- [x] `POST /api/v1/questions/{id}/attempt` — attempt is recorded in
  `question_attempts` collection
- [x] All tests pass: `pytest tests/test_questions.py`

### US-004: Stats endpoint tests
**Description:** As a developer, I need tests for the stats aggregation so the
$facet list→dict transformation that previously caused a 500 is regression-protected.

**Acceptance Criteria:**
- [x] `backend/tests/test_stats.py` created
- [x] Fixture inserts test question + records 3 attempts (2 correct easy, 1 wrong medium)
- [x] `GET /api/v1/stats/overview` — returns correct `total_questions_answered`,
  `correct_percentage`, `unique_chapters_covered`
- [x] `GET /api/v1/stats/questions` — returns `by_difficulty` as a **dict** (not list),
  keys are difficulty strings, values have `attempted` and `accuracy`
- [x] `GET /api/v1/stats/questions` — returns `by_topic` as a list
- [x] Empty state (no attempts): all endpoints return zeroed values, not 500
- [x] All tests pass: `pytest tests/test_stats.py`

### US-005: Cases and chapters smoke tests
**Description:** As a developer, I need smoke tests for cases and chapters so
basic list/detail routes are verified.

**Acceptance Criteria:**
- [x] `backend/tests/test_cases.py` created
- [x] Fixture inserts 1 test case into `test_db`
- [x] `GET /api/v1/cases/` — returns list with the test case; requires auth
- [x] `GET /api/v1/cases/{id}` — returns full case detail including all 8 fields
- [x] `GET /api/v1/cases/{id}` — nonexistent id returns 404
- [x] `backend/tests/test_chapters.py` created
- [x] Fixture inserts 1 test chapter with 2 sections into `test_db`
- [x] `GET /api/v1/chapters/` — returns list; requires auth
- [x] `GET /api/v1/chapters/{id}` — returns chapter with `part_number`, `part_title`,
  `chapter_number` fields present
- [x] `GET /api/v1/chapters/{id}` — nonexistent id returns 404
- [x] All tests pass: `pytest tests/test_cases.py tests/test_chapters.py`

## Non-Goals

- No AI/RAG endpoint tests (requires OpenAI API key — tested manually)
- No frontend tests (Playwright tests already exist for dashboard and auth)
- No load/performance tests
- No test coverage reporting (add later)

## Technical Considerations

- Use `mongomock` or real MongoDB — use **real MongoDB** (`CoreMD_test` db) to match
  production behavior, especially for aggregation pipelines
- `TestClient` from `starlette.testclient` (included with FastAPI) handles sync tests
- Override `MONGO_URI` in `pytest.ini` via env var so tests hit `CoreMD_test`, not `CoreMD`
- Each test that writes data should clean up via `test_db` fixture teardown
- The `auth_headers` fixture must use `test_db` — register against the test database
