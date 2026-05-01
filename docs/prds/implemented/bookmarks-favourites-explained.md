---
title: Bookmarks / Favourites — Implementation Explanation
feature: Backend CRUD endpoints + question-session bookmark toggle
status: partially implemented (US-001 ✓, US-002 ✓, US-003 pending)
---

# Bookmarks / Favourites

## 1. What Was Implemented and Why

Residents had no way to flag questions or cases they wanted to revisit. This feature introduces a **bookmark system** backed by a dedicated MongoDB collection, exposed through a REST API, and surfaced as a ★/☆ toggle button inside the question-bank session view.

**What was shipped (US-001 + US-002):**

- `POST /bookmarks` — idempotent upsert that creates a bookmark document.
- `DELETE /bookmarks/{item_id}` — removes a bookmark for the current user.
- `GET /bookmarks` — returns all bookmarks for the current user, with the full question or case document joined inline.
- `frontend/src/api/bookmarksApi.ts` — typed Axios wrapper around the three endpoints.
- Bookmark toggle (★/☆) added to `ChainCard` (multi-step mode) and to the standard/random player inside `QuestionsPage.tsx`.

**What is not yet shipped (US-003):**

- `BookmarksPage.tsx` — dedicated page with Questions / Cases tabs.
- Sidebar nav link and `/bookmarks` protected route.
- Bookmark toggle on `CaseDetailPage.tsx`.

The motivation: a starred question can be revisited deliberately rather than stumbled upon again by chance, which supports spaced-repetition study habits.

---

## 2. Key Design Decisions

### Upsert instead of insert for idempotency
`POST /bookmarks` uses MongoDB `update_one` with `upsert=True` and `$setOnInsert`. If the document already exists (user bookmarks the same item twice), the operation is a no-op — no duplicate is created and no error is returned. The frontend receives `{bookmarked: true}` either way.

### `{user_id, item_id}` compound filter (not compound unique index yet)
The PRD specifies a unique compound index. The current implementation uses `{user_id, item_id}` as the query filter for upsert, which achieves functional idempotency. The explicit `create_index` call was deferred — a future migration script or startup hook should add it to enforce the uniqueness constraint at the database level.

### Local toggle state — no prefetch on session start
The PRD explicitly forbids pre-fetching existing bookmarks at session start. Both implementations (ChainCard boolean and standard-player Set) start empty. The ★ therefore reflects actions taken *in this session only* — a question bookmarked in a previous session will appear as ☆ until the user taps it again. This is an intentional trade-off: it keeps the session start fast and avoids an extra API call on every question load.

### Two different state shapes for two player modes
- **ChainCard** (multi-step): one question visible at a time → `useState<boolean>(false)`. Resets to `false` whenever `question.question_id` changes (via a `useEffect` dependency).
- **Standard/random player** (multiple questions in a list): `useState<Set<string>>(new Set())` keyed by `question_id`. The Set persists across card transitions within one session and is cleared when the session resets.

### Silent failure on toggle errors
Both `handleBookmark` functions catch errors and do nothing. A bookmark is a convenience feature; a transient network error should not disrupt the question session with a toast or alert. The icon state stays at its new value optimistically — a minor UX simplification the PRD does not address.

### In-memory join on `GET /bookmarks`
The list endpoint iterates bookmark documents one-by-one and fetches each question or case document with a direct `find_one`. For the expected volume (dozens of bookmarks per user) this is simpler than a `$lookup` aggregation. A batch `$in` query would be a straightforward optimisation when the collection grows.

---

## 3. MongoDB Document Shape

### `bookmarks` collection — one document per saved item per user

```json
{
  "user_id": ObjectId("664a1b..."),
  "type": "question",
  "item_id": "q_042",
  "created_at": "2026-04-27T17:55:00Z"
}
```

| Field | Type | Notes |
|-------|------|-------|
| `user_id` | ObjectId | References the `users` collection |
| `type` | string | `"question"` or `"case"` |
| `item_id` | string | Matches `question_id` in `questions` or `case_id` in `cases` |
| `created_at` | datetime | UTC, set only on first insert via `$setOnInsert` |

`_id` and `user_id` are excluded from all API responses via `{"_id": 0, "user_id": 0}` projection.

### `GET /bookmarks` response shape

```json
[
  {
    "type": "question",
    "item_id": "q_042",
    "created_at": "2026-04-27T17:55:00Z",
    "document": {
      "question_id": "q_042",
      "stem": "A 34-year-old woman presents with…",
      "options": ["…", "…", "…", "…"],
      "correct_option": 1,
      "topic": "Cardiology",
      "difficulty": "medium"
    }
  }
]
```

`document` is `null` if the referenced question or case no longer exists (e.g., deleted from source collection).

---

## 4. How to Use the Feature

### Bookmark a question mid-session
1. Start any question session (topic, random, or multi-step).
2. A ☆ icon appears in the top-right of the question card header, next to the topic/difficulty badges.
3. Click ☆ to bookmark — it turns amber (★). Click again to remove.

### Call the API directly (curl / Swagger)

```bash
# Add a bookmark
POST /api/v1/bookmarks
Authorization: Bearer <jwt_token>
Content-Type: application/json
{"type": "question", "item_id": "q_042"}
# Returns: {"bookmarked": true}

# Remove a bookmark
DELETE /api/v1/bookmarks/q_042
Authorization: Bearer <jwt_token>
# Returns: {"bookmarked": false}

# List all bookmarks (optional filter: ?type=question or ?type=case)
GET /api/v1/bookmarks?type=question
Authorization: Bearer <jwt_token>
# Returns: array of bookmark objects with joined document
```

Swagger UI: `http://localhost:8000/docs` — the **bookmarks** tag groups all three endpoints.

---

## 5. Files Changed

### `backend/app/api/v1/routes/bookmarks.py` _(new file)_
Defines an `APIRouter` with prefix `/bookmarks` and three handlers:

- `POST ""` — validates `type` ∈ `{"question", "case"}`, then upserts into `bookmarks` using `$setOnInsert` to make the operation idempotent.
- `DELETE "/{item_id}"` — `delete_one` filtered by `{user_id, item_id}`.
- `GET ""` — accepts optional `type` query param, fetches matching bookmarks, then for each bookmark fetches the associated document from `questions` or `cases` and attaches it as `"document"`.

All three use `current_user: str = Depends(get_current_user)` and `db: Database = Depends(mongo_db)`.

### `backend/app/main.py`
Added `bookmarks` to the route import and registered the router:

```python
from app.api.v1.routes import ..., bookmarks
app.include_router(bookmarks.router, prefix="/api/v1")
```

No other changes to `main.py`.

### `frontend/src/api/bookmarksApi.ts` _(new file)_
Typed Axios wrapper. Exports:

- `BookmarkType` — `"question" | "case"` union type.
- `Bookmark` interface — matches the `GET /bookmarks` response item shape.
- `addBookmark(type, itemId)` — `POST /bookmarks`.
- `removeBookmark(itemId)` — `DELETE /bookmarks/{itemId}`.
- `getBookmarks(type?)` — `GET /bookmarks` with optional type filter.

Follows the same pattern as other `api/` modules: imports the shared `apiClient` instance (which injects the `Authorization` header automatically).

### `frontend/src/pages/QuestionsPage.tsx`
Two independent bookmark integrations in the same file:

**ChainCard component** (multi-step mode):
- Added `bookmarked: boolean` state, reset to `false` on `question.question_id` change.
- `handleBookmark` async function calls `addBookmark` / `removeBookmark` and flips state; errors are swallowed silently.
- The tag row (`flex flex-wrap gap-2`) is wrapped in a `justify-between` flex container; the ★/☆ button is placed at the end of that row.

**QuestionsPage component** (standard/random mode):
- Added `bookmarkedIds: Set<string>` state, cleared when the session resets.
- `handleBookmarkToggle(questionId)` mutates the Set immutably using `new Set(prev)` spread.
- The Set is cleared in the `handleStart` reset path alongside other session state.

---

## 6. Key Learnings

**Local state is sufficient when the PRD says no prefetch.** The acceptance criteria explicitly rule out fetching existing bookmark state on session start. Keeping toggle state local avoids an API call per session and sidesteps any loading/error state in the question view — the right trade-off for a non-critical convenience feature.

**Two state shapes for two player patterns.** ChainCard shows one question at a time so a single `boolean` is enough. The standard player renders questions as navigable cards within one session, so a `Set<string>` keyed by question ID is needed to track multiple bookmarks independently. Sharing a single mechanism would have forced unnecessary complexity into one or the other.

**`$setOnInsert` is the clean way to do idempotent inserts in MongoDB.** Using `upsert=True` with `$set` would overwrite `created_at` on repeated calls. `$setOnInsert` only writes fields when the document is being created for the first time — the semantically correct behaviour for a "bookmark created at" timestamp.

**Silently failing bookmark toggles is the right default.** The question session is the primary UX; an error saving a bookmark should never interrupt it. This pattern (try/catch with empty catch) is deliberate and should be maintained for any similar non-critical fire-and-forget actions in the session view.
