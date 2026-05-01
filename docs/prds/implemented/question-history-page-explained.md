---
title: Question History Page — Implementation Explanation
feature: Paginated attempt history log with inline reset
status: fully implemented (US-001 – US-002)
---

# Question History Page

## 1. What Was Implemented and Why

Residents had no way to review past quiz attempts or start fresh. This feature adds a **History page** that shows a chronological log of every answered question with date, a truncated question stem, and a pass/fail badge, plus a **Reset History** action that wipes all attempts after an inline confirmation step.

**What was shipped:**

- `GET /questions/history` — returns the current user's attempts, sorted newest-first, with the question stem joined in from the `questions` collection.
- `DELETE /questions/history` — deletes all attempt documents for the current user and returns a deleted count.
- `HistoryPage.tsx` — table-based UI with skeleton loading, an empty state, and an inline reset confirmation.
- Sidebar nav link and protected route wired up.

The motivation is self-awareness and control: residents benefit from seeing their track record, and a clean reset gives them a low-friction way to practice again from scratch without touching unrelated data.

---

## 2. Key Design Decisions

### In-memory join instead of `$lookup`
The backend fetches attempt documents first, collects the unique `question_id` values, bulk-fetches only `{question_id, stem}` from the `questions` collection in a single `$in` query, then merges results in Python. This is intentionally simpler than a MongoDB aggregation pipeline — no aggregation complexity or pipeline debugging — and the result set (max 200 attempts per call) is small enough that the extra round-trip is negligible.

### Inline reset confirmation, not a modal
The "Are you sure?" state is a local `confirmReset: boolean` that replaces the "Reset History" button in-place with a small amber warning strip containing Confirm and Cancel. There is no overlay, portal, or z-index management. This sidesteps z-index stacking issues that modals introduce in layouts with sticky sidebars and keeps the interaction entirely within normal document flow.

### Skeleton rows instead of a spinner
While loading, five `animate-pulse` placeholder rows are rendered at the same height as real rows. This prevents layout shift on load and gives the user an immediate sense of the page's structure.

### `limit=50`, no pagination UI
Fifty attempts covers the practical needs of an individual resident session review. Pagination is left as a future enhancement — the backend already accepts `limit` and `offset` query params, so the frontend can add it later without any API changes.

### Stem truncation is client-side
The full stem is returned from the API; the frontend's `truncate(text, 80)` slices it for display. Keeping truncation in the UI layer means raw data is always available for future features (e.g., a detail drawer) without a new API call.

---

## 3. MongoDB Collections Read

This feature reads from two existing collections; it does not create new collections or add fields.

**`question_attempts`** — one document per quiz attempt:

```json
{
  "_id": ObjectId("..."),
  "user_id": ObjectId("..."),
  "question_id": "q_001",
  "selected_option": 2,
  "correct_option": 3,
  "is_correct": false,
  "created_at": "2026-04-27T20:00:00Z"
}
```

`DELETE /questions/history` removes all documents where `user_id` matches the current user's ObjectId.

**`questions`** — the history endpoint reads only two fields:

```json
{
  "question_id": "q_001",
  "stem": "A 52-year-old man presents with progressive dyspnea…"
}
```

**API response shape** (what the frontend receives):

```json
{
  "items": [
    {
      "attempt_id": "664e3a...",
      "question_id": "q_001",
      "stem": "A 52-year-old man presents with progressive dyspnea…",
      "selected_option": 2,
      "correct_option": 3,
      "is_correct": false,
      "created_at": "2026-04-27T20:00:00Z"
    }
  ],
  "total": 42
}
```

`total` is the unfiltered count before `limit`/`offset` are applied, enabling future pagination.

---

## 4. How to Use the Feature

### In the browser
1. Log in and click **History** in the left sidebar (below Cases).
2. The page loads up to 50 most-recent attempts, newest first.
3. Each row shows: **Date** (e.g., "Apr 27, 2026"), **Question** (stem, max 80 chars), **Result** (✓ green / ✗ red).
4. If no attempts exist, an italic empty-state message is shown.
5. To reset: click **Reset History** (top-right) → an amber confirmation strip appears → click **Confirm** to delete all attempts, or **Cancel** to dismiss.

### Backend endpoints (curl / Swagger)

```bash
# Get history (authenticated)
GET /questions/history?limit=50&offset=0
Authorization: Bearer <jwt_token>

# Delete all attempts (authenticated)
DELETE /questions/history
Authorization: Bearer <jwt_token>
# Returns: {"deleted_count": 17}
```

Swagger UI is available at `http://localhost:8000/docs` when the dev server is running.

---

## 5. Files Changed

### `backend/app/api/v1/routes/questions.py`
Added three Pydantic models (`AttemptHistoryItem`, `AttemptHistoryResponse`, `DeleteHistoryResponse`) and two new route handlers at the end of the router, before the `/{question_id}` catch-all route (ordering matters — the catch-all would swallow `/history` if placed first).

- `GET /history` — counts total matching attempts, fetches the paginated slice sorted by `created_at` descending, bulk-fetches stems, merges in memory, returns `AttemptHistoryResponse`.
- `DELETE /history` — calls `delete_many` with the current user's ObjectId and returns the deleted count.

Both routes use `current_user: str = Depends(get_current_user)` from `app.core.auth` (the ID-only variant is sufficient here since neither endpoint needs the full user document).

### `frontend/src/api/historyApi.ts` _(new file)_
Defines three TypeScript interfaces (`AttemptHistoryItem`, `AttemptHistoryResponse`, `DeleteHistoryResponse`) and two exported functions:

- `getHistory(limit, offset)` — `GET /questions/history` via `apiClient`.
- `deleteHistory()` — `DELETE /questions/history` via `apiClient`.

Both return the raw Axios response, consistent with the rest of the `api/` layer.

### `frontend/src/pages/HistoryPage.tsx` _(new file)_
The page component. State: `items`, `loading`, `error`, `confirmReset`, `resetMessage`.

- On mount, calls `getHistory(50, 0)` and populates `items`.
- Renders skeleton rows while loading, an empty-state paragraph when `items` is empty, or a bordered table otherwise.
- The reset button toggles `confirmReset`; on confirm, calls `deleteHistory()`, clears `items`, and shows "History reset." inline.
- Two pure utility functions (`formatDate`, `truncate`) live at module scope to keep the JSX readable.

### `frontend/src/components/Sidebar.tsx`
Added a `HistoryIcon` SVG component (clock icon) and a new nav entry `{ to: "/history", label: "History", icon: <HistoryIcon />, end: false }` appended after the Cases link in `navItems`.

### `frontend/src/router.tsx`
Imports `HistoryPage` and adds `<Route path="/history" element={<HistoryPage />} />` inside the existing protected-route wrapper, alongside the other authenticated routes.

---

## 6. Key Learnings

**Keep reset confirmations inline, not in modals.** An inline boolean state (`confirmReset`) that swaps the button for a confirmation strip is simpler and avoids z-index conflicts with sticky sidebars. Modals require portal mounting, focus trapping, and careful z-index layering — unnecessary overhead for a single destructive action.

**Route order in `questions.py` is significant.** The `/{question_id}` catch-all route was already at the bottom of the file. The two new `/history` routes were inserted above it. Had they been appended after the catch-all, FastAPI would have matched `/history` as a `question_id` path parameter and returned a 404 from the question lookup.

**The in-memory join pattern is the right call at this scale.** Fetching attempts then bulk-fetching stems with `{"question_id": {"$in": ids}}` is two MongoDB queries and one Python dict lookup — straightforward to read, easy to test, and fast enough for up to 200 items. A `$lookup` aggregation would be harder to reason about and offers no practical performance benefit here.
