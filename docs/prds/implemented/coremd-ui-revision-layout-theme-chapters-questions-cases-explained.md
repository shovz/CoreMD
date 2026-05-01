# CoreMD UI Revision: Layout, Theme, Chapters, Questions, Cases (Explained)

## 1) What was implemented and why (high-level)
This revision delivered the end-to-end UI flow improvements and the linked follow-up question system, then stopped short of clinical case generation.

Implemented:
- US-001: warm paper/ink global theme tokens in CSS.
- US-002: left navigation sidebar (desktop) + mobile drawer behavior.
- US-003: dashboard performance charts (difficulty and topic breakdown).
- US-004: single-page Chapters reading experience (parts accordion + inline reader + Prev/Next section nav + Ask AI on text selection).
- US-005: idempotent linked follow-up seeding script with OpenAI + MongoDB indexes.
- US-006: API endpoint for linked follow-ups and inline chained follow-up UX in Question Detail.

Not implemented yet:
- US-007: OpenAI script to generate 20 clinical cases and case step questions.

Why this shape:
- The UI/navigation/theme changes were prioritized first for visible product alignment.
- Linked follow-up data generation (US-005) was implemented before runtime chaining (US-006) because US-006 depends on relationship data.

## 2) Key design decisions and reasoning
- Keep theme as `:root` CSS variables (`--paper`, `--paper-2`, `--ink`, etc.).
  - Reason: one palette source for all pages.

- Use Tailwind arbitrary value syntax for theme vars (for example `bg-[var(--paper)]`).
  - Reason: required for consistent Tailwind + CSS variable usage.

- Replace top navbar with a persistent sidebar and keep mobile drawer fallback.
  - Reason: matches intended layout while preserving small-screen usability.

- Rebuild Chapters as local in-page state instead of route-to-route reading navigation.
  - Reason: smoother reading flow and fewer route transitions.

- Sanitize HTML section content with `DOMPurify.sanitize(...)` before `dangerouslySetInnerHTML`.
  - Reason: preserve rich content while reducing injection risk.

- Reuse `useAiContext().openWithText` from text selection in chapter content.
  - Reason: consistent AI handoff UX across reading surfaces.

- Model follow-up links in a separate `question_followups` collection.
  - Reason: preserve existing `questions` schema and support ordered trigger-based chaining.

- Use two-phase follow-up seeding (insert questions first, then links).
  - Reason: deterministic idempotency and easier relationship validation on reruns.

- In Question Detail, chain follow-ups only on correct answers and cap chain length per visit.
  - Reason: coherent progression without random fallback or unbounded recursion.

## 3) MongoDB document shapes produced
### `questions` (new follow-up questions are stored here)
```json
{
  "question_id": "string",
  "stem": "string",
  "options": ["string", "string", "string", "string"],
  "correct_option": 0,
  "explanation": "string",
  "topic": "string",
  "chapter_ref": "string|null",
  "difficulty": "easy|medium|hard"
}
```

### `question_followups` (new collection)
```json
{
  "link_id": "string",
  "parent_question_id": "string",
  "followup_question_id": "string",
  "trigger": "correct",
  "priority": 1
}
```

Indexes:
- Unique: `question_followups.link_id`
- Query/index for fetch path: `(parent_question_id, trigger, priority)`
- Existing unique index remains on `questions.question_id`

Note:
- No new `cases`/`case_questions` documents were produced yet because US-007 is still pending.

## 4) How to run the script/feature
### Frontend UI features (US-001..US-004, US-006 UI)
From `frontend/`:
```bash
npm install
npm run dev
```

Type/build checks:
```bash
npx tsc -b
npm run build
```

Known environment issue from progress log:
- In this Windows environment, `npm run build` repeatedly failed with Vite/esbuild `spawn EPERM` while loading `vite.config.ts`.

### Follow-up generation script (US-005)
Required in `backend/.env`:
- `OPENAI_API_KEY`
- `MONGO_URI`

Run from `backend/`:
```bash
python scripts/generate_linked_questions.py
```

What it does:
- Maintains follow-up questions per selected parent questions.
- Inserts only missing question/link docs (idempotent).
- Prints per-parent progress and inserted/skipped summary.
- Verifies link integrity against existing `questions` documents.

### Follow-up API/runtime usage (US-006)
- Endpoint: `GET /api/v1/questions/{question_id}/followups?trigger=correct&limit=3`
- Returns `QuestionOut[]` only (safe fields; no correct answer/explanation).
- UI chain behavior appears in `QuestionDetailPage` after a correct answer.

### Backend tests used during this work
From `backend/`:
```bash
python -m pytest tests/test_questions.py
```

## 5) What files changed and what each change does
- `frontend/src/index.css`
  - Added warm paper/ink CSS variables and switched body background to paper theme.

- `frontend/src/components/Sidebar.tsx`
  - New left sidebar navigation with active/inactive styles, icons, Ask AI button, and mobile drawer/hamburger behavior.

- `frontend/src/components/AppShell.tsx`
  - Switched shell to sidebar + scrollable main content layout and removed top navbar rendering.

- `frontend/src/api/statsApi.ts`
  - Added `getStats()` alias for question stats retrieval used by dashboard performance section.

- `frontend/src/pages/DashboardPage.tsx`
  - Added Performance section with difficulty bars and top-topic bars.
  - Added loading skeletons and empty-state messaging when no attempts exist.

- `frontend/src/pages/ChaptersPage.tsx`
  - Rewritten to two-pane chapters reader: searchable parts accordion on left, inline section reader on right.
  - Added section navigation, sanitized HTML rendering, and text-selection “Ask AI about this”.

- `backend/scripts/generate_linked_questions.py`
  - Added OpenAI-backed linked follow-up generation.
  - Added idempotent insert logic, stable IDs (`question_id`, `link_id`), index creation, and integrity verification.

- `backend/app/api/v1/routes/questions.py`
  - Added `GET /questions/{question_id}/followups` with `trigger` and `limit`.
  - Returns ordered safe question payloads from `question_followups` links.

- `frontend/src/api/questionsApi.ts`
  - Added `getQuestionFollowUps(questionId, params)` client call.

- `frontend/src/pages/QuestionDetailPage.tsx`
  - Added inline follow-up chain state and rendering.
  - Fetches linked follow-up on correct answer, stops on incorrect/no-follow-up/max-chain, and only then shows “Next Question ->”.

- `backend/tests/test_questions.py`
  - Added/updated coverage for follow-up endpoint ordering, trigger filtering, limits, and missing-parent behavior.

- `backend/scripts/generate_cases.py`
  - Not created yet (US-007 pending).

## 6) Key learnings discovered during implementation (from `progress.txt`)
- Two-phase writes (questions first, links second) materially improve idempotent seeding reliability.
- Stable IDs + unique indexes + insert-only-missing checks are the most reusable seeding pattern.
- Integrity should be explicitly checked by verifying both `parent_question_id` and `followup_question_id` exist in `questions`.
- Tailwind + CSS variables must use arbitrary value syntax (for example `bg-[var(--paper)]`).
- Existing patterns (`DOMPurify`, `useAiContext().openWithText`) reduced implementation risk and sped delivery.
- `getSectionById(chapterId, sectionId)` returns both `html_content` and `content`, enabling robust chapter rendering fallback.
- On Windows/Python 3.11, prefer explicit `encoding="utf-8"` for file reads/writes.
- If `py_compile` fails due to `__pycache__` permission issues, in-memory `compile(...)` is a practical syntax-check fallback.
- In this environment, Vite/esbuild `spawn EPERM` blocked browser/build verification; TypeScript and targeted backend tests were used as fallback checks, with the PRD browser verification item kept explicitly unchecked.
