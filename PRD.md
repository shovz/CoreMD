# PRD: History Page — Cases Tab

## Introduction

The backend case history endpoints are already implemented (`GET /cases/history`, `DELETE /cases/history`, `DELETE /cases/history/selected`). `historyApi.ts` is missing the case history functions. This PRD adds the cases API client functions and the Cases tab to HistoryPage.

## Goals

- HistoryPage has a "Questions" / "Cases" tab toggle
- Cases tab shows case attempt history with selective and bulk reset

## User Stories

### US-001: Cases tab in HistoryPage + historyApi case functions
**Description:** As a resident, I want to see my case attempt history and reset it selectively, the same way I can with question history.

**Acceptance Criteria:**
- [x] `frontend/src/api/historyApi.ts` gains `getCaseHistory(limit: number, offset: number)` calling `GET /cases/history?limit=X&offset=Y`
- [x] `frontend/src/api/historyApi.ts` gains `deleteCaseHistory()` calling `DELETE /cases/history`
- [x] `frontend/src/api/historyApi.ts` gains `deleteSelectedCaseHistory(caseIds: string[])` calling `DELETE /cases/history/selected` with body `{ case_ids: caseIds }`
- [x] `frontend/src/pages/HistoryPage.tsx` has a "Questions" / "Cases" tab toggle row at the top (default: Questions tab)
- [x] Cases tab fetches `getCaseHistory(50, 0)` on first selection (lazy load)
- [x] Cases tab displays: checkbox, date, case title truncated to 80 chars, ✓/✗ result badge
- [x] Cases tab has a "Select All" header checkbox, "Reset Selected (N)" button (disabled when nothing checked), and "Reset All" button — same pattern as questions tab
- [x] Cases tab empty state: "No case history yet. Try a case study to get started."
- [x] Typecheck passes
- [x] Verify changes work in browser

## Non-Goals

- No pagination UI
- No changes to the backend (already done)

## Technical Considerations

- The `case_attempts` collection stores `case_id` as the identifier — use `case_id` (not `attempt_id`) for the `deleteSelectedCaseHistory` call since the endpoint filters by `case_id`
- Reuse the exact same checkbox/confirm/reset UI pattern already implemented in the questions tab
