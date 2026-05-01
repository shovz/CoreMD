---
title: Exclude Already-Answered Questions — Implementation Explanation
feature: Skip already correct toggle in Question Bank
status: implemented
---

# Exclude Already-Answered Questions

## 1. What Was Implemented and Why

Residents returning to the question bank were shown the same questions they had already answered correctly alongside new or missed ones. This made practice sessions inefficient — they'd waste time on mastered material instead of targeting gaps.

The feature adds a **"Skip already correct" toggle** to the Question Bank settings screen. When enabled, questions the user has already answered correctly at least once are removed from the session pool before the session starts. The backend exposes one new read-only endpoint to retrieve the user's correctly-answered question IDs; all filtering logic lives on the client.

---

## 2. Key Design Decisions

### Client-side filtering
Filtering is applied in the browser after fetching the answered IDs, rather than adding query parameters to the existing `_list_questions` backend function. This avoids complicating an already complex backend query and keeps the new endpoint simple and cacheable.

### Single endpoint, no query params
`GET /questions/answered-correctly` returns all correctly-answered question IDs for the authenticated user with no filters. The PRD explicitly excludes per-topic or per-difficulty exclusions; a flat list is sufficient and easy to reason about.

### MongoDB `distinct` query
The endpoint uses `db["question_attempts"].distinct("question_id", {...})` rather than aggregation. `distinct` is the simplest correct primitive — it returns unique values matching a filter in one call with no pipeline to maintain.

### `allFilteredByExclude` flag (not just empty pool)
When the exclude filter empties the pool entirely, the UI needs to show a *specific* message ("You've answered all questions correctly…") rather than the generic "No questions match filters." A dedicated boolean flag makes this distinction explicit and avoids conflating the two empty states.

### Graceful degradation on API failure
If the `GET /questions/answered-correctly` request fails, the catch block silently falls through and the session starts with the unfiltered pool. The user gets a working session rather than a broken one.

---

## 3. MongoDB Document Shapes

The endpoint queries the existing `question_attempts` collection. No new collections or schema changes were made.

**`question_attempts` collection (existing shape, relevant fields):**
```json
{
  "_id": ObjectId("..."),
  "user_id": ObjectId("..."),
  "question_id": "abc123",
  "is_correct": true,
  ...
}
```

The query used: `{ "user_id": ObjectId(current_user), "is_correct": true }` with `distinct("question_id")`.

**Response shape from the new endpoint:**
```json
{ "question_ids": ["abc123", "def456"] }
```

---

## 4. How to Use the Feature

### Backend endpoint (manual testing)
```bash
GET /questions/answered-correctly
Authorization: Bearer <jwt_token>
```
Returns `{"question_ids": [...]}` — an empty list if no questions have been answered correctly yet.

### Frontend
1. Navigate to the Question Bank.
2. Open the **Settings** panel.
3. Enable **"Skip already correct"** (checkbox, default off).
4. Click **Start Session** — the pool is filtered before the session begins.

If all questions in the selected topic/difficulty have been answered correctly and the toggle is on, the session screen shows:
> "You've answered all questions in this topic correctly. Disable 'Skip already correct' to review them."

---

## 5. Files Changed

### `backend/app/api/v1/routes/questions.py`
Added a response model and route handler at the end of the file:

```python
class AnsweredCorrectlyResponse(BaseModel):
    question_ids: List[str]

@router.get("/answered-correctly", response_model=AnsweredCorrectlyResponse)
def get_answered_correctly(
    current_user: str = Depends(get_current_user),
    db: Database = Depends(mongo_db),
):
    ids = db["question_attempts"].distinct(
        "question_id",
        {"user_id": ObjectId(current_user), "is_correct": True},
    )
    return {"question_ids": [str(qid) for qid in ids]}
```

Uses the same `get_current_user` dependency as the attempt endpoint, so authentication is consistent.

---

### `frontend/src/api/questionsApi.ts`
Added one function:

```typescript
export const getAnsweredCorrectly = () => {
  return api.get<{ question_ids: string[] }>("/questions/answered-correctly");
};
```

---

### `frontend/src/pages/QuestionsPage.tsx`
Four additions:

**`SessionSettings` interface** — added `excludeAnswered: boolean`:
```typescript
interface SessionSettings {
  mode: Mode;
  difficulty: Difficulty | "";
  topics: string[];
  sessionLength: number;
  timerSeconds: number;
  excludeAnswered: boolean;  // ← new
}
```

**`DEFAULT_SETTINGS`** — defaults the toggle to off:
```typescript
const DEFAULT_SETTINGS: SessionSettings = {
  ...
  excludeAnswered: false,
};
```

**SettingsScreen toggle UI** — renders a checkbox row:
```typescript
<SettingRow label="Skip already correct">
  <label className="flex cursor-pointer items-center gap-3">
    <input
      type="checkbox"
      checked={excludeAnswered}
      onChange={(e) => setExcludeAnswered(e.target.checked)}
      className="h-4 w-4 rounded border-slate-300 accent-blue-600"
    />
    <span className="text-sm text-slate-700">
      Exclude questions you've already answered correctly
    </span>
  </label>
</SettingRow>
```

**Pool-loading `useEffect` (inside `load` function)** — fetches and applies the filter after building the shuffled pool, before slicing to session length:
```typescript
if (settings.excludeAnswered) {
  try {
    const answeredRes = await getAnsweredCorrectly();
    const answeredIds = new Set(answeredRes.data.question_ids);
    collected = collected.filter((q) => !answeredIds.has(q.question_id));
  } catch {
    // fall through with unfiltered pool if request fails
  }
}
setAllFilteredByExclude(settings.excludeAnswered && collected.length === 0);
```

**Empty-state rendering** — shows the right message:
```typescript
{allFilteredByExclude
  ? "You've answered all questions in this topic correctly. Disable 'Skip already correct' to review them."
  : "No questions match the selected filters."}
```

---

## 6. Key Learnings

**Order matters in the load pipeline.** The exclude filter must run after the shuffled pool is built but *before* slicing to `sessionLength`. Applying it too early (pre-shuffle) or too late (post-slice) produces incorrect results — either the filter is skipped or the session is shorter than the user expects without a clear reason.

**Separate the "all answered" empty state from the generic "no results" empty state.** An empty pool can mean two distinct things: the user's filters simply match no questions, or they've answered every matching question correctly. Using a single boolean flag (`allFilteredByExclude`) set at load time keeps the distinction clean and avoids conditional logic scattered through the render tree.
