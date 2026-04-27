# PRD: Question History Page

## Introduction

Residents have no way to review their past question attempts or reset their progress. Adding a History page shows a paginated log of all answered questions with pass/fail results, and a "Reset History" action lets them start fresh.

## Goals

- A backend endpoint returns the current user's attempt history with question stems included
- A backend endpoint deletes all of the current user's attempts
- A History page in the frontend displays attempts with date, truncated question stem, and result badge
- A "Reset History" button clears all attempts after confirmation

## User Stories

### US-001: Backend — question history endpoints
**Description:** As a developer, I need API endpoints to retrieve and delete a user's attempt history so the frontend History page can display and reset it.

**Acceptance Criteria:**
- [x] `GET /questions/history` added to `backend/app/api/v1/routes/questions.py`
  - Query params: `limit: int = 50`, `offset: int = 0`
  - Queries `question_attempts` collection filtered by `user_id: ObjectId(current_user)`, sorted by `created_at` descending
  - For each attempt, looks up the question in `questions` collection by `question_id` to get `stem`
  - Returns list of `{attempt_id, question_id, stem, selected_option, correct_option, is_correct, created_at}` + `total` count
- [x] `DELETE /questions/history` added to `backend/app/api/v1/routes/questions.py`
  - Deletes all documents in `question_attempts` where `user_id == ObjectId(current_user)`
  - Returns `{"deleted_count": int}`
- [x] Both endpoints use `current_user: str = Depends(get_current_user)` from `app.core.auth`
- [x] Typecheck passes

### US-002: Frontend — HistoryPage with reset
**Description:** As a resident, I want to see all my past question attempts with results so I can review my performance, and reset my history when I want to start fresh.

**Acceptance Criteria:**
- [ ] New file `frontend/src/pages/HistoryPage.tsx` created
- [ ] Fetches `GET /questions/history?limit=50&offset=0` on mount
- [ ] Displays a list: each row shows date (formatted as "Apr 26, 2026"), truncated question stem (max 80 chars), a ✓ (green) or ✗ (red) result badge
- [ ] Empty state: "No question history yet. Start a session in the Question Bank."
- [ ] "Reset History" button at top-right — clicking shows a confirmation inline message ("Are you sure? This cannot be undone.") with Confirm / Cancel buttons
- [ ] On confirm: calls `DELETE /questions/history`, clears the list, shows "History reset."
- [ ] `frontend/src/router.tsx` has a protected route `/history` → `HistoryPage`
- [ ] `frontend/src/components/Sidebar.tsx` has a "History" nav link (added below the Questions link)
- [ ] Typecheck passes
- [ ] Verify changes work in browser

## Non-Goals

- No case attempt history (questions only in this PRD)
- No per-topic filtering or date-range filtering
- No pagination UI (limit=50 is enough for MVP; pagination can be added later)
- No export/download

## Technical Considerations

- The join between `question_attempts` and `questions` should be done in Python (not MongoDB $lookup) for simplicity — fetch attempt docs, collect unique question_ids, bulk-fetch questions in one query, merge in memory
- `frontend/src/api/` — add `historyApi.ts` with `getHistory(limit, offset)` and `deleteHistory()`
