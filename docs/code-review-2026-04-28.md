# CoreMD Full Code Review (Working Tree)
Date: 2026-04-28
Scope: `backend/`, `frontend/`, `infra/` with current uncommitted changes included.

## Executive Summary
The project has critical backend security exposure and a broken auth/test contract in the current working tree. The backend test suite currently fails at scale (`3 failed, 29 errors`) and most downstream APIs are effectively untestable due to auth regression.

## Findings

### 1. Critical: Sensitive infrastructure secrets are exposed by unauthenticated health endpoint
- Severity: Critical
- Evidence:
  - `GET /health` returns `mongo_uri` and `redis_url` directly from settings in [backend/app/main.py](/D:/JavaScript/Personal-Projects/Training/CoreMD/backend/app/main.py:75).
- Impact:
  - Leaks internal service topology and credentials when URIs include auth info.
  - Increases blast radius for reconnaissance and lateral movement.
- Recommendation:
  - Return only non-sensitive operational state (e.g., `{ "status": "ok" }`).
  - If detailed diagnostics are needed, gate them behind admin auth and environment checks.

### 2. High: Public debug endpoint exposes internal DB details and raw error messages
- Severity: High
- Evidence:
  - Unauthenticated `GET /api/v1/debug/mongo-ping` prints and returns DB internals in [backend/app/api/v1/routes/debug.py](/D:/JavaScript/Personal-Projects/Training/CoreMD/backend/app/api/v1/routes/debug.py:8).
  - Returns raw exception strings in response body (`"message": str(e)`), same file lines 25-28.
- Impact:
  - Information disclosure of internal DB names and error surfaces.
  - Makes targeted exploitation easier.
- Recommendation:
  - Remove this route from production build, or protect with strict admin auth + feature flag.
  - Never return raw exception details to clients.

### 3. High: Auth/register contract changed without updating tests and callers; backend suite is effectively broken
- Severity: High
- Evidence:
  - `full_name` is required in `UserCreate` in [backend/app/schemas/user.py](/D:/JavaScript/Personal-Projects/Training/CoreMD/backend/app/schemas/user.py:12).
  - Existing tests still register with only `{email,password}` in [backend/tests/test_auth.py](/D:/JavaScript/Personal-Projects/Training/CoreMD/backend/tests/test_auth.py:18).
  - Test run: `python -m pytest` reports `422` on register and auth token fixture failures cascading through other suites.
- Impact:
  - Core API validation contract is inconsistent with test expectations and likely with existing clients.
  - Massive regression risk: most authenticated flows fail in CI/local validation.
- Recommendation:
  - Either make `full_name` optional with default handling, or update all backend tests and any client flows to provide it.
  - Add explicit API contract tests for register payload requirements.

### 4. High: Stats aggregations use inconsistent chapter field names, causing incorrect analytics
- Severity: High
- Evidence:
  - Question models/routes use `chapter_ref` (e.g., [backend/app/api/v1/routes/questions.py](/D:/JavaScript/Personal-Projects/Training/CoreMD/backend/app/api/v1/routes/questions.py:25)).
  - Stats pipelines aggregate using `$question.chapter_id` in [backend/app/services/stats_service.py](/D:/JavaScript/Personal-Projects/Training/CoreMD/backend/app/services/stats_service.py:81) and [backend/app/services/stats_service.py](/D:/JavaScript/Personal-Projects/Training/CoreMD/backend/app/services/stats_service.py:318).
- Impact:
  - `unique_chapters_covered` and per-chapter stats can be wrong/empty depending on stored documents.
  - Dashboard insights become untrustworthy.
- Recommendation:
  - Standardize on one field (`chapter_ref` or `chapter_id`) across schema, seeds, services, and tests.
  - Backfill existing data and add migration guards.

### 5. Medium: Dashboard stats cache is never invalidated on new attempts
- Severity: Medium
- Evidence:
  - Dashboard cache key is set in [backend/app/api/v1/routes/stats.py](/D:/JavaScript/Personal-Projects/Training/CoreMD/backend/app/api/v1/routes/stats.py:61).
  - Attempt write-path invalidates only overview/questions/chapters keys in [backend/app/services/question_attempt_service.py](/D:/JavaScript/Personal-Projects/Training/CoreMD/backend/app/services/question_attempt_service.py:29).
- Impact:
  - `/stats/dashboard` can serve stale data up to TTL, even immediately after answering questions.
- Recommendation:
  - Also delete `stats:dashboard:{user_id}` in attempt write path.

### 6. Medium: Mutable default list in request schema
- Severity: Medium
- Evidence:
  - `history: List[HistoryMessage] = []` in [backend/app/schemas/ai.py](/D:/JavaScript/Personal-Projects/Training/CoreMD/backend/app/schemas/ai.py:11).
- Impact:
  - Risk of shared mutable state across instances in Python defaults.
- Recommendation:
  - Use `Field(default_factory=list)`.

### 7. Medium: Mixed auth dependency patterns increase fragility and maintenance risk
- Severity: Medium
- Evidence:
  - Some routes use `app.core.auth.get_current_user` (returns user id string), others use `app.api.deps.auth.get_current_user` (returns user document), e.g. [backend/app/api/v1/routes/auth.py](/D:/JavaScript/Personal-Projects/Training/CoreMD/backend/app/api/v1/routes/auth.py:8) vs [backend/app/api/v1/routes/questions.py](/D:/JavaScript/Personal-Projects/Training/CoreMD/backend/app/api/v1/routes/questions.py:9).
- Impact:
  - Hidden type/behavior differences raise risk of runtime bugs during refactors.
- Recommendation:
  - Consolidate to one auth dependency API with explicit typed variants (e.g., `get_current_user_id`, `get_current_user_doc`).

### 8. Low: Frontend auth state can become stale because routing logic bypasses AuthContext
- Severity: Low
- Evidence:
  - `AppShell` checks raw `localStorage` instead of context state in [frontend/src/components/AppShell.tsx](/D:/JavaScript/Personal-Projects/Training/CoreMD/frontend/src/components/AppShell.tsx:6).
  - Login page stores token but does not call `setUser`, in [frontend/src/pages/LoginPage.tsx](/D:/JavaScript/Personal-Projects/Training/CoreMD/frontend/src/pages/LoginPage.tsx:20).
- Impact:
  - UI state may flicker or show inconsistent authenticated surfaces until refresh/effect cycle.
- Recommendation:
  - Drive auth rendering from `AuthContext` state and update it on login/logout transitions.

## Test Status
Command executed:
- `python -m pytest` (in `backend/`)

Result:
- `3 failed, 7 passed, 29 errors`

Primary failure signature:
- Register endpoint returns `422` due to required `full_name`, causing login fixture token creation to fail and cascading errors.

## Residual Risks / Gaps
- Frontend E2E (`npx playwright test`) and frontend lint/build were not executed in this pass.
- Infra deployment scripts were reviewed only lightly; no deployment dry-run was performed.

## Recommended Remediation Order
1. Fix auth contract mismatch (`full_name`) and stabilize tests.
2. Remove/lock down sensitive debug and health outputs.
3. Unify chapter field naming and patch stats aggregations.
4. Add dashboard cache invalidation on attempt writes.
5. Normalize auth dependency layer and clean remaining schema defaults.
