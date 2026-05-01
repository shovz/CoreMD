# Dashboard — Implementation Explained

## 1. What Was Implemented and Why

The resident dashboard is the first screen a logged-in user sees. Before this work the backend stats service was already complete — three endpoints with Redis caching — but `DashboardPage.tsx` was a placeholder that only rendered "You are logged in." This PRD wired the existing API to a real UI.

| Story | Scope |
|---|---|
| US-001 | Typed API client for the two stats endpoints |
| US-002 | Three overview stat cards (answers, accuracy, chapters) |
| US-003 | Difficulty and topic bar charts with weak-area highlighting |
| US-004 | Full `DashboardPage` assembly with empty state and nav link |

No backend changes were needed. All four user stories are complete.

---

## 2. Key Design Decisions

### Parallel data fetching
`DashboardPage` calls `getOverviewStats()` and `getQuestionStats()` in parallel via `Promise.all`. This halves the perceived load time versus sequential `await` calls, since both endpoints are independent.

### Single reusable chart component
`AccuracyBarChart` is a generic component that accepts `{label, attempted, accuracy}[]` and a `title`. Both the difficulty chart and the topic chart are rendered by the same component — the caller transforms API data into that shape. This avoids duplicating recharts configuration.

### Weak-area threshold as a named constant
The `60%` cutoff for red highlighting is defined as `WEAK_AREA_THRESHOLD = 60` at the top of `AccuracyBarChart.tsx`, not inlined as a magic number. This makes it easy to locate and change, and documents its intent.

### Dynamic bar coloring via a Cell-level render prop
Each accuracy bar is individually colored: red (`#ef4444`) when `accuracy < WEAK_AREA_THRESHOLD`, blue (`#3b82f6`) otherwise. recharts' `<Cell>` component is mapped over each data entry to apply per-bar colors. The attempted-count bars use a fixed neutral color since only accuracy indicates weakness.

### `by_difficulty` key normalization
The API returns `by_difficulty` as a plain object with string keys (`"easy"`, `"medium"`, `"hard"`). `DashboardPage` maps `Object.entries(by_difficulty)` to the `{label, attempted, accuracy}` shape expected by `AccuracyBarChart`. This keeps the chart component free of API-specific knowledge.

### Topic data sorted by attempted descending
`by_topic` is sorted before being passed to the chart so the most-practiced specialties appear first. This makes the chart immediately informative rather than displaying an arbitrary API order.

### Empty state instead of empty charts
If `total_questions_answered === 0`, the page renders a single message ("No attempts yet — head to the Question Bank to get started") rather than two empty charts. Empty charts are visually confusing; the message directs the user to act.

### Skeleton loading state
While data is in flight, `StatCard` renders a greyed placeholder (`"—"`) rather than nothing. This preserves layout and signals that content is loading without a separate spinner component.

### No frontend caching
The backend already caches stats in Redis for 120 seconds. Adding a second cache layer on the frontend would only complicate invalidation, so none was added.

---

## 3. MongoDB Document Shapes Produced

This feature is read-only on the frontend — it fetches from existing endpoints and writes no new documents. The backing collections (`question_attempts`, `user_progress`) are documented in the Question Bank and PDF Ingestion explained files.

The two API response shapes consumed by this feature:

**`GET /stats/overview`**
```json
{
  "total_questions_answered": 42,
  "correct_percentage": 71.4,
  "unique_chapters_covered": 8
}
```

**`GET /stats/questions`**
```json
{
  "by_difficulty": {
    "easy":   {"attempted": 15, "accuracy": 86.7},
    "medium": {"attempted": 20, "accuracy": 65.0},
    "hard":   {"attempted": 7,  "accuracy": 42.9}
  },
  "by_topic": [
    {"topic": "Cardiology", "attempted": 12, "accuracy": 75.0},
    {"topic": "Nephrology", "attempted": 8,  "accuracy": 50.0}
  ]
}
```

Both endpoints require a valid JWT. The `apiClient` Axios instance injects the `Authorization: Bearer <token>` header automatically.

---

## 4. How to Run

### Start the backend
```bash
cd backend
python -m uvicorn app.main:app --reload   # http://localhost:8000
```

### Start the frontend
```bash
cd frontend
npm run dev   # http://localhost:5173
```

Log in and navigate to `/dashboard`. The page loads stat cards and two bar charts. Hover over any bar to see exact values in the tooltip. Bars in the accuracy series turn red when accuracy is below 60%.

If the user has no attempts yet, only the empty-state message is shown.

### Type checking
```bash
cd frontend
npm run build   # TypeScript check + bundle
```

---

## 5. Files Changed

| File | Action | What it does |
|---|---|---|
| `frontend/src/api/statsApi.ts` | Created | Axios wrappers `getOverviewStats()` and `getQuestionStats()` with TypeScript types `OverviewStats` and `QuestionStats`. Uses the existing `apiClient` instance so auth headers are injected automatically. |
| `frontend/src/components/StatCard.tsx` | Created | Presentational card component. Accepts `label`, `value`, and optional `sub` props. Renders a large value with a label below it in a bordered card. Shows `"—"` as a skeleton when no value is passed. |
| `frontend/src/components/AccuracyBarChart.tsx` | Created | Generic recharts `BarChart` wrapper. Two bars per entry: `attempted` (count, fixed color) and `accuracy` (%, red below `WEAK_AREA_THRESHOLD`, blue otherwise). Includes legend, axis labels, and a hover tooltip. |
| `frontend/src/pages/DashboardPage.tsx` | Replaced entirely | Fetches both stat endpoints in parallel, composes `StatCard` × 3, two `AccuracyBarChart` instances (difficulty and topic), a logout button, and an empty-state message. Manages a single `loading` / `error` state pair shared by both fetches. |
| `frontend/package.json` | Modified | `recharts` added as a runtime dependency (installed with `--legacy-peer-deps` due to React 19). |

---

## 6. Key Learnings (from progress.txt)

### recharts peer dependency conflict with React 19

`recharts` declares `react-is` as a peer dependency but does not list it in its own `dependencies`. React 19 changed how peer deps resolve, which causes a Rollup build failure when `react-is` is missing.

**Fix:** install `react-is` explicitly alongside recharts:

```bash
npm install recharts react-is --legacy-peer-deps
```

The `--legacy-peer-deps` flag is required because recharts' peer dep declarations reference React 18 ranges that do not satisfy `^19`. Without it, npm refuses to install entirely.
