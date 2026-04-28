# PRD: History Enhancements — Selective Reset + Cases Tab

## Introduction

The History page currently only allows resetting all question attempts at once and has no cases history. This PRD adds per-item checkboxes for selective reset of questions, and a full Cases tab with the same functionality.

## Goals

- Users can check individual question history rows and reset only those attempts
- "Reset All" button remains for bulk reset
- A Cases tab shows case attempt history with the same selective + bulk reset capability
- Case attempts are stored in MongoDB when submitted (currently not persisted for history)

## User Stories

### US-001: Backend — selective question history delete endpoint
**Description:** As a developer, I need an endpoint to delete specific question attempts by question_id so users can selectively reset individual questions.

**Acceptance Criteria:**
- [x] `DELETE /questions/history/selected` endpoint added to `backend/app/api/v1/routes/questions.py`
- [x] Request body: `{"question_ids": ["id1", "id2", ...]}`
- [x] Deletes all `question_attempts` documents where `question_id IN question_ids AND user_id == ObjectId(current_user)`
- [x] Returns `{"deleted_count": int}`
- [x] Uses `current_user: str = Depends(get_current_user)` from `app.core.auth`
- [x] Route is ordered BEFORE any `/{attempt_id}` wildcard routes to avoid path conflicts
- [x] Typecheck passes

### US-002: Backend — case attempts history storage + endpoints
**Description:** As a developer, I need case attempts to be persisted and queryable so the History page can show a cases tab.

**Acceptance Criteria:**
- [ ] `backend/app/api/v1/routes/cases.py` case attempt submission (`POST /cases/{case_id}/questions/{question_id}/attempt`) saves to a `case_attempts` collection: `{user_id: ObjectId, case_id: str, question_id: str, selected_option: str, correct_option: str, is_correct: bool, case_title: str, created_at: datetime}`
- [ ] `GET /cases/history?limit=50&offset=0` endpoint added — queries `case_attempts` by `user_id`, returns list of `{attempt_id, case_id, case_title, question_id, selected_option, correct_option, is_correct, created_at}` sorted by `created_at` desc + `total` count
- [ ] `DELETE /cases/history` endpoint — deletes all `case_attempts` for current user, returns `{"deleted_count": int}`
- [ ] `DELETE /cases/history/selected` endpoint — body `{"case_ids": ["id1", ...]}` — deletes all attempts for those case_ids for current user, returns `{"deleted_count": int}`
- [ ] All new endpoints use `current_user: str = Depends(get_current_user)` from `app.core.auth`
- [ ] Typecheck passes

### US-003: Frontend — HistoryPage questions tab with checkboxes + selective reset
**Description:** As a resident, I want to select specific question attempts and reset only those so I can retry individual questions without losing all my history.

**Acceptance Criteria:**
- [ ] `frontend/src/pages/HistoryPage.tsx` questions tab has a checkbox on each row (leftmost column)
- [ ] A "Select All" checkbox in the table header toggles all row checkboxes
- [ ] "Reset Selected" button appears (disabled when no rows checked); on click: shows confirmation inline → on confirm calls `DELETE /questions/history/selected` with `{question_ids: selectedIds}` → removes those rows from the list
- [ ] Existing "Reset All" button kept; on confirm calls `DELETE /questions/history` as before
- [ ] `frontend/src/api/historyApi.ts` gains `deleteSelectedHistory(questionIds: string[])` calling `DELETE /questions/history/selected`
- [ ] Typecheck passes
- [ ] Verify changes work in browser

### US-004: Frontend — HistoryPage Cases tab
**Description:** As a resident, I want to see my case attempt history and reset it selectively, the same way I can with questions.

**Acceptance Criteria:**
- [ ] `HistoryPage.tsx` has a "Questions" / "Cases" tab toggle (default: Questions)
- [ ] Cases tab fetches `GET /cases/history?limit=50&offset=0` on first selection
- [ ] Cases tab displays: date, case title (truncated 80 chars), result badge ✓/✗
- [ ] Cases tab has same checkbox + "Reset Selected" + "Reset All" pattern as questions tab
- [ ] `frontend/src/api/historyApi.ts` gains `getCaseHistory(limit, offset)`, `deleteCaseHistory()`, `deleteSelectedCaseHistory(caseIds: string[])` 
- [ ] Empty state: "No case history yet. Try a case study to get started."
- [ ] Typecheck passes
- [ ] Verify changes work in browser

## Non-Goals

- No pagination UI beyond limit=50
- No date-range filtering
- No export/download of history

## Technical Considerations

- Route ordering in `cases.py`: `/cases/history` and `/cases/history/selected` must be registered BEFORE `/cases/{case_id}` to avoid FastAPI treating "history" as a case_id
- The `case_title` is denormalized into `case_attempts` at write time to avoid a join on every history read
- `historyApi.ts` is at `frontend/src/api/historyApi.ts`
