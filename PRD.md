# PRD: Dashboard

## Introduction

The user dashboard is the home screen for logged-in residents. The backend stats service
is fully implemented (three endpoints with Redis caching) but the frontend is a placeholder
that only says "You are logged in." This PRD wires the existing API to a real dashboard UI
with overview stat cards, a difficulty breakdown bar chart, and a topic breakdown bar chart
with weak-area flagging.

## Goals

- Display three overview stats: total questions answered, overall accuracy %, chapters covered
- Show a bar chart of attempts and accuracy broken down by difficulty (easy / medium / hard)
- Show a bar chart of attempts and accuracy broken down by topic (specialty)
- Flag any difficulty or topic where accuracy < 60% as a weak area (red highlight)
- Replace the placeholder DashboardPage.tsx entirely
- Add a Dashboard link to the navigation

## User Stories

### US-001: Stats API client
**Description:** As a developer, I need a typed API client for the stats endpoints so
frontend components can fetch real data.

**Acceptance Criteria:**
- [x] `frontend/src/api/statsApi.ts` created
- [x] `getOverviewStats()` calls `GET /stats/overview`, returns `OverviewStats` type: `{total_questions_answered: number, correct_percentage: number, unique_chapters_covered: number}`
- [x] `getQuestionStats()` calls `GET /stats/questions`, returns `QuestionStats` type with `by_difficulty: Record<string, {attempted: number, accuracy: number}>` and `by_topic: {topic: string, attempted: number, accuracy: number}[]`
- [x] Both functions use the existing `apiClient` Axios instance (auth header injected automatically)
- [x] `recharts` added to `frontend/package.json` dependencies via `npm install recharts`
- [x] Typecheck passes

### US-002: Overview stat cards
**Description:** As a resident, I want to see my key stats at a glance when I open the
dashboard so I know how I'm progressing.

**Acceptance Criteria:**
- [x] `frontend/src/components/StatCard.tsx` created — accepts `label: string`, `value: string | number`, `sub?: string` props; renders a bordered card with a large value and a label
- [x] Three cards rendered on the dashboard: "Questions Answered", "Accuracy" (formatted as "X%"), "Chapters Covered"
- [x] Cards shown in a responsive 3-column grid (single column on mobile)
- [x] While loading, cards show a skeleton/placeholder state (greyed box or "—")
- [x] On API error, shows an inline error message instead of crashing
- [x] Typecheck passes

### US-003: Difficulty and topic bar charts
**Description:** As a resident, I want to see my performance broken down by difficulty
and specialty so I can identify where to focus.

**Acceptance Criteria:**
- [ ] `frontend/src/components/AccuracyBarChart.tsx` created — accepts `data: {label: string, attempted: number, accuracy: number}[]` and `title: string` props
- [ ] Renders a recharts BarChart with two bars per entry: one for `attempted` count, one for `accuracy %`
- [ ] Any bar where `accuracy < 60` is rendered in red (#ef4444); otherwise default blue (#3b82f6)
- [ ] Chart has a legend, axis labels, and a tooltip showing exact values on hover
- [ ] Weak-area threshold defined as named constant `WEAK_AREA_THRESHOLD = 60`
- [ ] Typecheck passes

### US-004: Assemble DashboardPage
**Description:** As a resident, I want a complete dashboard that shows all my stats in
one place when I log in.

**Acceptance Criteria:**
- [ ] `frontend/src/pages/DashboardPage.tsx` fully replaced — fetches from both `getOverviewStats()` and `getQuestionStats()` in parallel via `Promise.all`
- [ ] Page layout: heading "My Dashboard" → StatCards row → DifficultyChart → TopicChart
- [ ] Difficulty chart title: "Performance by Difficulty" — data mapped from `by_difficulty`
- [ ] Topic chart title: "Performance by Specialty" — data mapped from `by_topic`, sorted by `attempted` descending
- [ ] Logout button retained in top-right corner
- [ ] If `total_questions_answered === 0`, show empty state message: "No attempts yet — head to the Question Bank to get started"
- [ ] Nav link to Dashboard added to Home page or shared nav component
- [ ] Typecheck passes
- [ ] Verify changes work in browser: dashboard loads, cards show numbers, charts render

## Non-Goals

- No chapter-level progress breakdown (separate PRD)
- No date range filtering or historical trend charts
- No comparison against other users or averages
- No recommended next questions feature
- No print or export functionality

## Technical Considerations

- All three stat endpoints require JWT — `apiClient` handles this automatically via the Authorization header interceptor in `frontend/src/api/apiClient.ts`
- Stats are cached by the backend for 120 seconds (Redis) — no frontend caching needed
- `by_difficulty` keys from the API are dynamic strings ("easy", "medium", "hard") — map them to `{label, attempted, accuracy}` before passing to `AccuracyBarChart`
- Use `npm install recharts --legacy-peer-deps` if React 19 peer dep conflict occurs
- Empty state: if `total_questions_answered === 0`, show message instead of empty charts

### API Response Shapes (already implemented in backend)

**GET /stats/overview:**
```json
{"total_questions_answered": 42, "correct_percentage": 71.4, "unique_chapters_covered": 8}
```

**GET /stats/questions:**
```json
{
  "by_difficulty": {
    "easy":   {"attempted": 15, "accuracy": 86.7},
    "medium": {"attempted": 20, "accuracy": 65.0},
    "hard":   {"attempted": 7,  "accuracy": 42.9}
  },
  "by_topic": [
    {"topic": "Cardiology",  "attempted": 12, "accuracy": 75.0},
    {"topic": "Nephrology",  "attempted": 8,  "accuracy": 50.0}
  ]
}
```

### Files to Create / Modify

| File | Action |
|---|---|
| `frontend/src/api/statsApi.ts` | Create |
| `frontend/src/components/StatCard.tsx` | Create |
| `frontend/src/components/AccuracyBarChart.tsx` | Create |
| `frontend/src/pages/DashboardPage.tsx` | Replace entirely |
| `frontend/package.json` | Add recharts |
