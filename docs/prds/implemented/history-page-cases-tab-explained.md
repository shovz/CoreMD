# History Page — Cases Tab: Explained

## 1. What Was Implemented and Why

The backend case history endpoints (`GET /cases/history`, `DELETE /cases/history`, `DELETE /cases/history/selected`) were already in place from a prior sprint. This sprint completed the user-facing half: API client functions in `historyApi.ts` and a Cases tab inside `HistoryPage` that mirrors the existing Questions tab.

Before this work, residents had no way to view or reset their case study attempt history through the UI, even though the data was being persisted. The goal was parity: the same checkbox-select, reset-selected, and reset-all workflow that exists for questions is now available for cases.

---

## 2. Key Design Decisions

### Lazy load on first tab switch
Case history is not fetched on mount — it is fetched the first time the user switches to the Cases tab (`cLoaded` flag prevents re-fetching on subsequent tab switches). This avoids an unnecessary network call for users who never open the Cases tab in a given session.

### Selection keyed on `case_id`, not `attempt_id`
The `case_attempts` collection stores one document per question per case session. A single case may produce multiple attempt rows. The selective delete endpoint (`DELETE /cases/history/selected`) deletes **all attempts for a given `case_id`**, so the checkbox selection tracks `case_id` via a `Set<string>`. Checking any row for a case selects the whole case's worth of attempts, which matches the backend contract.

### Deduplication for "Select All" count
`uniqueCaseIds` is derived with `Array.from(new Set(cItems.map(i => i.case_id)))` before computing `cAllChecked`. Without this, a case with three question attempts would count as three rows toward the "all selected" threshold even though there is only one selectable unit.

### Reuse of the inline confirmation pattern
Rather than introducing a new interaction model, the Cases tab reuses the exact same inline confirm/cancel widget used in the Questions tab — amber-bordered row with "Confirm" and "Cancel" text buttons replacing the action button in place. Consistent for the user; no new components needed.

### `indeterminate` checkbox state via DOM ref
The "Select All" header checkbox uses a `ref` callback (`if (el) el.indeterminate = cSomeChecked`) because `indeterminate` is not a React-controlled prop and cannot be set via a JSX attribute. The same technique is used in the Questions tab.

### Axios `DELETE` with body uses the `data` key
`axios.delete` does not accept a body as a second positional argument. The payload must be passed as `{ data: { … } }` inside the config object. Both `deleteSelectedHistory` and `deleteSelectedCaseHistory` follow this pattern.

---

## 3. MongoDB Document Shapes

The Cases tab reads from the `case_attempts` collection (written by the case attempt endpoint from the previous sprint). Each document represents one question answer within one case session:

```json
{
  "_id": ObjectId("..."),
  "user_id": ObjectId("..."),
  "case_id": "case-xyz456",
  "question_id": "cq-step1",
  "selected_option": 1,
  "correct_option": 3,
  "is_correct": false,
  "case_title": "Chest Pain in a 52-Year-Old Male",
  "created_at": ISODate("2026-04-28T10:05:00Z")
}
```

Key points:
- `case_title` was denormalised into each document at write time (previous sprint), so the history endpoint returns it directly with no join.
- Multiple documents share the same `case_id` — one per step/question in the case.
- The frontend receives these as flat rows and groups/deduplicates for the selection logic client-side.

The `GET /cases/history` response shape that `getCaseHistory` types against:

```typescript
interface CaseHistoryItem {
  attempt_id: string;
  case_id: string;
  case_title: string;
  question_id: string;
  selected_option: number;
  correct_option: number;
  is_correct: boolean;
  created_at: string;
}

interface CaseHistoryResponse {
  items: CaseHistoryItem[];
  total: number;
}
```

---

## 4. How to Run / Use the Feature

### Start the backend
```bash
cd backend
python -m uvicorn app.main:app --reload
```

### Start the frontend
```bash
cd frontend
npm run dev
```

Navigate to `/history`. The page opens on the Questions tab by default. Click **Cases** to switch tabs — case history loads on first switch. The tab uses the same layout: checkbox column, date, case title (truncated to 80 characters), and a ✓/✗ result badge.

**Reset controls:**
- **Reset Selected (N)** — enabled when at least one row is checked; shows inline confirmation before calling `DELETE /cases/history/selected`.
- **Reset All** — shows inline confirmation before calling `DELETE /cases/history`.

After a successful delete, affected rows are removed from local state immediately without a re-fetch.

No migrations or seed scripts are needed. The `case_attempts` collection already exists if any case questions have been answered.

---

## 5. Files Changed and What Each Change Does

| File | Change |
|------|--------|
| `frontend/src/api/historyApi.ts` | Added `CaseHistoryItem` and `CaseHistoryResponse` TypeScript interfaces. Added three exported functions: `getCaseHistory(limit, offset)` calling `GET /cases/history`, `deleteCaseHistory()` calling `DELETE /cases/history`, and `deleteSelectedCaseHistory(caseIds)` calling `DELETE /cases/history/selected` with `{ data: { case_ids: caseIds } }`. |
| `frontend/src/pages/HistoryPage.tsx` | Added `activeTab` state (`"questions" \| "cases"`, default `"questions"`). Added a pill-style tab toggle row rendering "Questions" and "Cases" buttons. Added a full parallel state block for the Cases tab (`cItems`, `cLoaded`, `cLoading`, `cError`, `cConfirmReset`, `cConfirmResetSelected`, `cResetMessage`, `cSelected`). Added a `useEffect` that triggers `getCaseHistory` the first time `activeTab === "cases"`. Added `uniqueCaseIds` deduplication and `cAllChecked`/`cSomeChecked` derived values. Added `toggleCAll`, `toggleCRow`, `handleConfirmCReset`, `handleConfirmCResetSelected` handlers. Rendered the Cases tab branch (loading skeleton → empty state → table) mirroring the Questions tab layout. |

---

## 6. Key Learnings

### Axios DELETE with a body needs `{ data: … }` not a positional argument
`axios.post(url, body)` takes the body as the second argument; `axios.delete(url, config)` takes a config object as the second argument. Passing the payload directly as the second argument silently discards it — the backend receives an empty list and deletes nothing. The correct form is `api.delete(url, { data: { case_ids: ids } })`.

### React `indeterminate` is DOM-only
The `indeterminate` property of a checkbox is not part of React's virtual DOM and cannot be set through JSX. Setting it requires a `ref` callback: `ref={(el) => { if (el) el.indeterminate = someChecked; }}`. Without this, the header checkbox always appears either fully checked or unchecked, never in the partial-selection state.

### Lazy tab loading avoids unnecessary network calls
Gating a fetch behind a `cLoaded` boolean and triggering it only inside a `useEffect` that depends on `[activeTab, cLoaded]` is the minimal pattern for lazy tab initialisation. No library is needed; the boolean prevents double-fetching on re-renders while the effect ensures the fetch fires exactly once when the tab is first opened.

### Selective case delete is scoped to `case_id`, not `attempt_id`
The backend endpoint removes all attempt rows for the given `case_ids` in one call. The frontend must therefore select by `case_id`, not the row's `attempt_id`, or it would be sending a meaningless identifier to the backend. This is a non-obvious contract — the endpoint name says "selected" but the granularity is case-level, not attempt-level.
