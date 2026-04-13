# PRD: Question Bank

## Introduction

With Harrison's content now in MongoDB, the next core feature is the Question Bank —
a set of MCQ (multiple-choice question) cards that residents can use to test their knowledge
chapter by chapter. The backend already records attempts and calculates stats; what's missing
is the question data itself, the listing/filtering API, and the frontend UI.

## Goals

- Seed a representative set of sample MCQs into MongoDB (one per chapter for ~20 chapters as a starting set)
- Expose a working questions listing API with filtering by topic, chapter, and difficulty
- Build a frontend MCQ page where residents can browse, attempt, and review questions
- Wire attempt recording to the existing `question_attempt_service` (already implemented)
- Show per-question feedback (correct/incorrect + explanation) after each attempt

## User Stories

### US-001: Question schema and MongoDB seeding
**Description:** As a developer, I need question documents in MongoDB so the API and
frontend have real data to work with.

**Acceptance Criteria:**
- [x] `backend/scripts/seed_questions.py` created with 20 sample MCQs across at least 5 different specialties
- [x] Each question document contains: `question_id` (str), `stem` (str), `options` (list of 4 str), `correct_option` (int, 0-indexed), `explanation` (str), `topic` (str), `chapter_ref` (str, matching a `chapter_id` in `chapters`), `difficulty` ("easy" | "medium" | "hard")
- [x] Script is idempotent: re-running skips already-inserted questions (keyed on `question_id`)
- [x] Running `python backend/scripts/seed_questions.py` inserts questions and prints count
- [x] Typecheck passes

### US-002: Questions listing and filtering API
**Description:** As a developer, I need API endpoints to list questions with optional
filters so the frontend can display and filter the question bank.

**Acceptance Criteria:**
- [x] `GET /questions/` returns paginated list of questions (default limit 20, offset 0)
- [x] Supports query params: `topic` (str), `chapter_id` (str), `difficulty` ("easy"|"medium"|"hard")
- [x] Response schema: `QuestionOut` with fields `question_id`, `stem`, `options` (list of str), `topic`, `chapter_ref`, `difficulty` — does NOT include `correct_option` or `explanation` (revealed only after attempt)
- [x] `GET /questions/{question_id}` returns full question including `correct_option` and `explanation`
- [x] All routes require valid JWT
- [x] Typecheck passes

### US-003: Question attempt endpoint
**Description:** As a developer, I need the attempt endpoint to return correctness feedback
and the explanation so the frontend can show the result.

**Acceptance Criteria:**
- [x] `POST /questions/{question_id}/attempt` accepts `{"selected_option": 0}` body
- [x] Returns `{"correct": true/false, "correct_option": int, "explanation": str}`
- [x] Records attempt in MongoDB via existing `question_attempt_service.record_attempt()`
- [x] Returns 404 if `question_id` not found
- [x] Requires valid JWT
- [x] Typecheck passes

### US-004: Questions page (list + filter UI)
**Description:** As a resident, I want to browse questions filtered by specialty or
difficulty so I can focus my study.

**Acceptance Criteria:**
- [ ] `frontend/src/pages/QuestionsPage.tsx` created
- [ ] Fetches questions from `GET /questions/` on load
- [ ] Displays question stems in a list (no options visible yet — click to attempt)
- [ ] Filter bar: difficulty dropdown (All / Easy / Medium / Hard) + topic text filter
- [ ] Each question row shows topic badge and difficulty badge
- [ ] Route `/questions` added to `frontend/src/router.tsx`
- [ ] Link to Questions page added to nav/home
- [ ] `frontend/src/api/questionsApi.ts` created with `getQuestions(filters)` and `getQuestionById(id)`
- [ ] Typecheck passes
- [ ] Verify changes work in browser

### US-005: Question attempt UI
**Description:** As a resident, I want to attempt a question and immediately see whether
I was right, with an explanation, so I can learn from my mistakes.

**Acceptance Criteria:**
- [ ] Clicking a question from QuestionsPage navigates to `/questions/:id`
- [ ] `frontend/src/pages/QuestionDetailPage.tsx` created
- [ ] Displays: question stem, 4 answer options as selectable buttons
- [ ] On option click: calls `POST /questions/{id}/attempt`, disables all options
- [ ] Correct option highlighted green, selected wrong option highlighted red
- [ ] Explanation text shown below options after attempt
- [ ] "Back to Questions" link present
- [ ] `questionsApi.ts` includes `submitAttempt(questionId, selectedOption)`
- [ ] Typecheck passes
- [ ] Verify changes work in browser

## Non-Goals

- No AI-generated questions (manual seed only for this PRD)
- No question editing or admin CRUD UI
- No timed quiz mode
- No bulk import from external question banks
- No question flagging or reporting
- No leaderboard or social features

## Technical Considerations

- Existing `question_attempt_service.record_attempt()` in `backend/app/services/question_attempt_service.py` already handles recording — reuse it in US-003
- Existing `POST /questions/{question_id}/attempt` route in `backend/app/api/v1/routes/questions.py` is a stub — replace it (don't add a new route)
- `question_id` format: `q_{chapter_id}_{index}` (e.g. `q_p06_c238_001`) for stable idempotent re-seeding
- Questions listing does NOT expose `correct_option` to prevent cheating — reveal only via the attempt endpoint
- The `chapters` collection now has real data — seed questions should reference real `chapter_id` values (use `p06_c238` style IDs matching what ingestion produced)
- Frontend filter state can be managed with `useState` (no URL params needed for MVP)
- Reuse existing `apiClient.ts` Axios instance for `questionsApi.ts`

### MongoDB Document Shape

```json
{
  "question_id": "q_p06_c238_001",
  "stem": "A 65-year-old man presents with exertional dyspnea and ankle edema. Which finding on physical exam is most consistent with right heart failure?",
  "options": [
    "S3 gallop at apex",
    "Jugular venous distension",
    "Bilateral crackles at lung bases",
    "Displaced apical impulse"
  ],
  "correct_option": 1,
  "explanation": "Jugular venous distension (JVD) reflects elevated right atrial pressure, which is the hallmark of right heart failure. S3 gallop and displaced apical impulse suggest left heart failure; bilateral crackles suggest pulmonary edema from left heart failure.",
  "topic": "Cardiology",
  "chapter_ref": "p06_c238",
  "difficulty": "medium"
}
```

### Files to Create / Modify

| File | Action |
|---|---|
| `backend/scripts/seed_questions.py` | Create |
| `backend/app/schemas/question.py` | Create — Pydantic models for QuestionOut, AttemptRequest, AttemptResponse |
| `backend/app/api/v1/routes/questions.py` | Replace stub with real implementation |
| `frontend/src/pages/QuestionsPage.tsx` | Create |
| `frontend/src/pages/QuestionDetailPage.tsx` | Create |
| `frontend/src/api/questionsApi.ts` | Create |
| `frontend/src/router.tsx` | Add /questions and /questions/:id routes |
