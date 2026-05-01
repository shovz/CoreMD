# History Enhancements — Selective Reset + Cases Tab: Explained

## 1. What Was Implemented and Why

The History page previously only supported a single "Reset All" button for question attempts, and had no record of case study attempts at all. This sprint added two capabilities:

1. **Selective reset for question history** — users can check individual rows and delete only those attempts, keeping the rest of their history intact.
2. **Case attempt persistence + history endpoints** — every case question submission is now written to a `case_attempts` MongoDB collection with a full audit trail, and three new REST endpoints expose it for a future Cases tab.

The frontend Cases tab (US-004) was not implemented in this sprint; the backend infrastructure is complete and ready for a follow-up UI story.

---

## 2. Key Design Decisions

### Route ordering in FastAPI
Both `questions.py` and `cases.py` use a pattern where static path segments (`/history`, `/history/selected`) must be registered **before** any parameterised wildcard route (`/{question_id}`, `/{case_id}`). FastAPI evaluates routes in declaration order; if the wildcard is declared first, `"history"` is matched as an id and the static endpoints are never reached. All history routes sit above the `/{…}` routes in both files.

### `case_title` denormalised at write time
When a case question attempt is submitted, the case's `title` is fetched from the `cases` collection and written directly into the `case_attempts` document. This avoids a join on every history read — the title is stable enough that denormalisation is the right trade-off for a read-heavy history list.

### Selective delete scoped to `case_id`, not `attempt_id`
`DELETE /cases/history/selected` accepts a list of `case_ids` and removes **all attempts for those cases** for the current user. This matches the UX intent: the user selects a case row and removes everything related to that case, not individual per-question attempts within it.

### Inline confirmation pattern (frontend)
Rather than a modal dialog, the "Reset Selected" and "Reset All" buttons replace themselves inline with a confirmation widget (amber-bordered row with Confirm / Cancel). This keeps focus in the table area without a z-index overlay, and cancelling restores the original button with no network call.

### `indeterminate` checkbox state via `ref`
The "Select All" header checkbox uses a React `ref` callback to set `el.indeterminate = someChecked` because the indeterminate state is not a React-controlled prop — it can only be set via the DOM property.

---

## 3. MongoDB Document Shapes

### `question_attempts` (pre-existing collection, unchanged shape)
```json
{
  "_id": ObjectId("..."),
  "user_id": ObjectId("..."),
  "question_id": "q-abc123",
  "selected_option": 2,
  "correct_option": 2,
  "is_correct": true,
  "created_at": ISODate("2026-04-28T10:00:00Z")
}
```

### `case_attempts` (new collection, written by US-002)
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

Key fields:
- `user_id` — stored as `ObjectId`; every query filters on this to scope to the authenticated user.
- `case_title` — denormalised string copied from `cases.title` at insert time.
- No compound index was added in this sprint; if the collection grows, a `{ user_id: 1, created_at: -1 }` index would benefit the history listing query.

---

## 4. How to Run / Use the Feature

### Backend
```bash
cd backend
python -m uvicorn app.main:app --reload
```

No migrations or seed scripts needed — `case_attempts` is created lazily by MongoDB on first insert.

### New endpoints

| Method | Path | Description |
|--------|------|-------------|
| `DELETE` | `/questions/history/selected` | Delete specific question attempts by `question_ids` |
| `GET` | `/cases/history?limit=50&offset=0` | Paginated case attempt history for the current user |
| `DELETE` | `/cases/history` | Bulk-delete all case attempts for the current user |
| `DELETE` | `/cases/history/selected` | Delete case attempts by `case_ids` |

All endpoints require a valid JWT (`Authorization: Bearer <token>`).

### Frontend
The Questions tab of the History page (`/history`) now shows a checkbox column. Checking rows enables the "Reset Selected (N)" button; clicking it shows an inline confirmation before calling the backend.

---

## 5. Files Changed and What Each Change Does

### Backend

| File | Change |
|------|--------|
| `backend/app/api/v1/routes/questions.py` | Added `SelectiveDeleteRequest` Pydantic model and `DELETE /history/selected` endpoint. Placed above the `/{question_id}` wildcard to avoid path conflict. |
| `backend/app/api/v1/routes/cases.py` | Added four Pydantic models (`CaseAttemptHistoryItem`, `CaseAttemptHistoryResponse`, `CaseDeleteHistoryResponse`, `CaseSelectiveDeleteRequest`) and three history endpoints (`GET /history`, `DELETE /history`, `DELETE /history/selected`). Modified `POST /{case_id}/questions/{question_id}/attempt` to persist each submission into `case_attempts`, including a lookup for `case_title`. All history endpoints are declared before `/{case_id}`. |

### Frontend

| File | Change |
|------|--------|
| `frontend/src/api/historyApi.ts` | Added `deleteSelectedHistory(questionIds: string[])` which calls `DELETE /questions/history/selected` with the id list in the request body. |
| `frontend/src/pages/HistoryPage.tsx` | Added `selected: Set<string>` state and checkbox column. Header checkbox uses `indeterminate` state via DOM ref. Row highlight (`bg-blue-50`) when checked. "Reset Selected" button with inline confirm/cancel flow calling `deleteSelectedHistory`. After success, selected rows are filtered out of local state without a re-fetch. |

---

## 6. Key Learnings

### FastAPI route ordering is declaration order
Static segments like `/history` must be declared before parameterised routes like `/{case_id}`. This applies in any router where a wildcard segment could swallow a known word. The fix is always positional — move the static route higher in the file.

### React `indeterminate` is DOM-only
The `indeterminate` property on a checkbox element is not part of React's controlled prop system — it cannot be set via JSX attributes. The only reliable way to apply it is through a `ref` callback that sets `element.indeterminate` directly.

### Denormalising `case_title` at write time simplifies reads
Joining back to the `cases` collection for every history item would require either an aggregation pipeline or N+1 queries. Writing the title into `case_attempts` once at insert is the right call for a title that rarely changes.

### Axios `DELETE` with a body requires the `data` key
When calling `axios.delete` with a request body, the payload must be passed as `{ data: { … } }` inside the config object — unlike `POST`/`PUT` where the body is the second positional argument. Forgetting this sends the delete with no body and the backend receives an empty list.
