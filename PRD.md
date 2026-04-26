# PRD: Exclude Already-Answered Questions

## Introduction

Residents who return to the question bank to practice see the same questions they already answered correctly mixed into every session. Adding a "Skip already correct" toggle lets them focus only on new or previously missed questions, making practice sessions more efficient.

## Goals

- A backend endpoint returns the list of question IDs the current user answered correctly at least once
- The Question Bank settings screen has a "Skip already correct" toggle (default off)
- When enabled, questions the user already answered correctly are removed from the session pool before the session starts

## User Stories

### US-001: Backend endpoint — list correctly-answered question IDs
**Description:** As a developer, I need an endpoint that returns the question IDs a user has already answered correctly so the frontend can filter them out of the session pool.

**Acceptance Criteria:**
- [x] `GET /questions/answered-correctly` endpoint added to `backend/app/api/v1/routes/questions.py`
- [x] Uses `current_user: str = Depends(get_current_user)` from `app.core.auth` (same dep as the attempt endpoint)
- [x] Queries `question_attempts` collection: `{user_id: ObjectId(current_user), is_correct: true}`, returns distinct `question_id` strings
- [x] Response schema: `{"question_ids": ["id1", "id2", ...]}`
- [x] Returns empty list if user has no correct attempts
- [x] Typecheck passes (mypy or FastAPI startup with no errors)

### US-002: Frontend — "Skip already correct" toggle in Question Bank settings
**Description:** As a resident, I want to toggle "Skip already correct" in the Question Bank settings so that I only practice questions I haven't mastered yet.

**Acceptance Criteria:**
- [ ] `SessionSettings` interface in `frontend/src/pages/QuestionsPage.tsx` gains `excludeAnswered: boolean`
- [ ] `DEFAULT_SETTINGS` sets `excludeAnswered: false`
- [ ] The SettingsScreen renders a toggle row labeled "Skip already correct" — a checkbox or pill toggle that reads/writes `settings.excludeAnswered`
- [ ] `questionsApi.ts` gains `getAnsweredCorrectly(): Promise<{ question_ids: string[] }>` calling `GET /questions/answered-correctly`
- [ ] When "Start Session" is clicked and `settings.excludeAnswered` is true, the function calls `getAnsweredCorrectly()`, then filters the shuffled pool: `pool.filter(q => !answeredIds.has(q.question_id))`
- [ ] If all questions are filtered out, show an inline message: "You've answered all questions in this topic correctly. Disable 'Skip already correct' to review them."
- [ ] Typecheck passes
- [ ] Verify changes work in browser

## Non-Goals

- No backend filtering — filtering is done client-side after fetching the answered IDs
- No per-topic exclude (exclude applies globally across all topics in the session)
- No "exclude partially correct" or attempt-count thresholds

## Technical Considerations

- The `/questions/answered-correctly` endpoint is a read-only GET with no query params — simple and cacheable
- Client-side filtering avoids changing the complex `_list_questions` backend function
- `questionsApi.ts` location: `frontend/src/api/questionsApi.ts`
