# CoreMD UI Overhaul — 5 Surfaces: Implementation Explained

## 1. What Was Implemented and Why

CoreMD is a medical learning platform for internal medicine residents. The UI overhaul redesigns five surfaces to make the app feel like a coherent study tool rather than a collection of scaffolded pages:

| Surface | New Design |
|---|---|
| Dashboard | "Study Deck" — streak, accuracy, continue card, weak-topic chips |
| Chapters | "Specialty Spine" — sidebar Part list + accordion chapter browser |
| Question Bank | Topic cards with per-topic accuracy stats + styled option cards |
| Case Studies | Card library → vignette + discussion + step-gated clinical questions |
| AI Assistant | Ambient floating launcher + inline highlight-to-ask; no standalone `/chat` |

The PRD defines 13 user stories (US-001 → US-013). All are complete.

| Story | Scope |
|---|---|
| US-001 | Commit existing AppShell, TopNavbar, page scaffolding |
| US-002 | `GET /api/v1/stats/dashboard` endpoint |
| US-003 | `case_questions` MongoDB schema + REST endpoints |
| US-004 | Seed 10 case questions across first 5 cases |
| US-005 | `DashboardPage` — Study Deck layout |
| US-006 | `ChaptersPage` — Specialty Spine layout |
| US-007 | `SectionDetailPage` — Open-book two-page spread |
| US-008 | `QuestionsPage` — topic cards with per-topic stats |
| US-009 | `QuestionDetailPage` — richer attempt UX |
| US-010 | `CasesPage` — Case Library card grid |
| US-011 | `CaseDetailPage` — Vignette + discussion + multi-step questions |
| US-012 | Remove `/chat` route; make AI launcher a slide-over panel |
| US-013 | `SectionDetailPage` — inline highlight → ask AI |

Backend stories (US-001–004) were completed first to provide a stable data contract. Frontend stories (US-005–013) were completed surface by surface. US-007 and US-013 share a file and were developed together.

---

## 2. Key Design Decisions

### Dashboard stats are computed on demand, not maintained incrementally
`stats_service.get_dashboard_stats` runs three MongoDB aggregation pipelines per request (totals, last attempt, weak topics) and caches the result in Redis for 120 seconds (`stats:dashboard:{user_id}`). This is simpler than maintaining running counters and safe at current data volumes. The cache key is per-user so one user's flush does not invalidate another's.

### Streak walks backward from most recent activity date
`_compute_streak` groups all attempts by calendar date, then walks the sorted list backward day-by-day. If the most recent active date is more than one day before today the streak resets to 0. This correctly handles "active yesterday but not today" — the streak is preserved until midnight.

### Weak topics use a hard 60% accuracy threshold
Any topic where `(correct / attempted) * 100 < 60` is flagged weak. Up to 3 topics are returned, sorted by accuracy ascending (worst first). The threshold is a product decision; if it changes, the aggregation `$match` in `stats_service.py` is the single place to update it.

### `last_chapter` is inferred from question attempts, not tracked separately
Rather than maintaining a `last_visited_chapter` field on the user document, the dashboard endpoint looks at the most recent question attempt and follows its `chapter_ref` to the `chapters` collection. This avoids a separate upsert path but means a user who browses a chapter without answering questions will not see it in "Continue". The PRD acknowledges this trade-off as acceptable for MVP.

### `case_questions` is a new collection, not embedded in `cases`
Case questions live in a separate `case_questions` collection. This allows the questions endpoint to return an empty list without touching the case document, supports independent indexing by `(case_id, step)`, and keeps case documents small. No migration of the `cases` collection was needed.

### Seed script deduplication via pre-query, not exception swallowing
`seed_case_questions.py` fetches all existing `case_question_id` values into a Python set before inserting, then filters to only the new entries. `insert_many` is called once. This is more efficient than per-document insert-with-catch and avoids swallowing unexpected errors. A unique index on `case_question_id` provides a safety net.

### DashboardPage conditionally renders each section
The "Continue" card is suppressed entirely if both `last_chapter` and `last_question` are null. The "Focus Topics" section is suppressed if `weak_topics` is empty. When the user has no history at all (`questions_answered === 0`), only the empty-state message is shown.

### ChaptersPage uses a dual-index for sidebar vs. accordion state
The sidebar always renders all parts (complete spine overview), while the accordion in the main area renders only `visibleParts` (filtered by search). Clicking a sidebar item sets `activePart` (sidebar highlight), adds the part to `expandedParts` (opens accordion), and calls `scrollIntoView`. "Which part is active" and "which parts are expanded" are separate state slices so the user can open multiple accordions while the sidebar still tracks the most recently navigated part.

### Search auto-expands all matching parts
When `searchQuery` is non-empty, the `isOpen` check for each accordion becomes `!!searchQuery || expandedParts.has(partNum)`. All parts that survive the `visibleParts` filter are expanded automatically during search, without updating `expandedParts`. Clearing the search reverts accordions to their pre-search state, which is intentional.

### 300ms debounce on searches
Both `ChaptersPage` and `QuestionsPage` update their display-only input state immediately (responsive typing) but delay the computed filter state by 300ms via a ref-managed `setTimeout`. Expensive filter/memo computation runs only once the user pauses. The timeout is cleaned up on unmount.

### QuestionsPage topic cards derive accuracy client-side
The page fetches questions in 100-item batches and computes per-topic accuracy from attempt history returned alongside the question list. Card border/background color reflects accuracy tiers: green ≥ 70%, yellow 40–69%, red < 40%, neutral grey if unattempted. URL query param `?topic=<topic>` drives the active filter so Dashboard "Focus Topics" chip links work directly.

### QuestionDetailPage chains questions via location state
`QuestionsPage` pushes `{ questionIds, currentIndex, topic }` into React Router location state when navigating to a question. `QuestionDetailPage` reads this state to render a "Next Question" button and navigate to the next question in the same filtered set. If location state is absent (direct navigation), the page fetches a random question in the same topic after submission.

### CasesPage specialty color mapping uses a fixed dictionary with a fallback
A dictionary maps known specialty strings (e.g., `"cardiology"`) to Tailwind color classes. Any specialty not in the dictionary falls back to slate. This avoids a dynamic Tailwind class generation problem where purging would remove unused variants.

### CaseDetailPage step-gating is index-based
A single `unlocked` counter tracks the highest answered step. The rendered question list is always `questions.slice(0, unlocked + 1)`. Each question card manages its own `{ selected, result, submitting }` state inside the `stepStates` array. Submitting a step increments `unlocked` to reveal the next question below — no page navigation.

### AI panel state lives in a React context at router root
`AiContext` (36 lines) provides `open`, `openWithText(text)`, and `clearPrefill()` to the entire tree. `openWithText` pre-formats the text as `Regarding: "{text}" — ` and sets `open = true`. The context is instantiated at the `AiContextProvider` root in `router.tsx` so every page and every component in the tree can open the panel with a pre-filled prompt.

### Slide-over is rendered inside `AiChatLauncher`, not in AppShell
The backdrop overlay, slide-over panel, and `AssistantChat` are all rendered by `AiChatLauncher`. `AppShell` only decides *whether* to render the launcher (based on authentication state). This keeps all AI panel DOM logic co-located in one component.

### Pre-fill text flows via props, not context, into AssistantChat
`AiChatLauncher` reads `prefillText` from context and passes it as a prop to `AssistantChat`, along with an `onPrefillConsumed` callback. `AssistantChat` uses a `useEffect` on `prefillText` to set the input field and auto-focus it after a 50ms delay (to allow the panel animation to complete). After consuming the text it calls `onPrefillConsumed()` which calls `clearPrefill()` in context, preventing the text from re-applying on subsequent renders.

### SectionDetailPage selection popover uses `getBoundingClientRect` for positioning
`mouseup` and `selectionchange` listeners on the content pane check `window.getSelection()`. If the selection is non-empty and contained within the right-pane element, the popover state is set with `x/y` coordinates from `getBoundingClientRect()` of the selection range. The popover is absolutely positioned and disappears when the selection is cleared or the AI panel opens.

---

## 3. MongoDB Document Shapes

### `case_questions` collection

One document per question step. The seed script produces 10 documents (2 per case × 5 cases).

```json
{
  "case_question_id": "cq_case_cardiology_001_s1",
  "case_id": "case_cardiology_001",
  "step": 1,
  "stem": "A 58-year-old diabetic man presents with ...",
  "options": [
    "Non-ST-elevation myocardial infarction (NSTEMI)",
    "Inferior ST-elevation myocardial infarction (STEMI) due to RCA occlusion",
    "Anterior STEMI due to LAD occlusion",
    "Unstable angina with demand ischaemia"
  ],
  "correct_option": 1,
  "explanation": "ST elevations in the inferior leads ..."
}
```

**Key points:**
- `case_question_id` format: `cq_{case_id}_s{step}` — natural key, URL-safe, deterministic
- `correct_option` is **0-indexed** (matches `options` array position)
- `step` is 1-indexed (step 1, step 2, …); queries always sort by `(case_id, step)` ASC
- MongoDB `_id` is excluded from all API responses (`{"_id": 0}` projection)

**Indexes created by the seed script:**
```
{ case_question_id: 1 }  (unique)     — primary lookup + idempotency
{ case_id: 1, step: 1 }               — list query for GET /cases/{id}/questions
```

### `question_attempts` collection (read-only from stats perspective)

The dashboard aggregates over this existing collection. Relevant fields:

```json
{
  "user_id": ObjectId("..."),
  "question_id": "q_112",
  "is_correct": true,
  "created_at": ISODate("2026-04-23T14:30:00Z")
}
```

The stats pipelines `$lookup` from `question_attempts` into `questions` on `question_id` to get `topic` and `chapter_ref`. No new fields were added to this collection.

---

## 4. How to Run

### Seed case questions (one-time, idempotent)

```bash
# From project root — requires MONGO_URI in backend/.env
python backend/scripts/seed_case_questions.py
```

Expected output:
```
Inserted 10 case question(s). Skipped 0.
```

Re-running produces:
```
All case questions already present — nothing to insert.
```

The script loads `backend/.env` via `python-dotenv`. Falls back to `MONGO_URI` environment variable, defaulting to `mongodb://localhost:27017/CoreMD`.

### Start the backend

```bash
cd backend
python -m uvicorn app.main:app --reload   # http://localhost:8000
```

Verify the new endpoints (all require `Authorization: Bearer <token>`):
```
GET  /api/v1/stats/dashboard
GET  /api/v1/cases/case_cardiology_001/questions
POST /api/v1/cases/case_cardiology_001/questions/cq_case_cardiology_001_s1/attempt
     Body: {"selected_option": 1}
```

### Start the frontend

```bash
cd frontend
npm run dev   # http://localhost:5173
```

Pages to exercise:
- `/dashboard` — Study Deck (streak, accuracy, continue card, weak topics)
- `/chapters` — Specialty Spine (sidebar + accordion)
- `/chapters/{id}/sections/{id}` — Open-book layout; select any text to trigger "Ask AI about this"
- `/questions` — Topic card grid; clicking a card filters the list below
- `/questions/{id}` — Option cards; submit to reveal explanation and "Next Question"
- `/cases` — Case Library card grid with specialty filter pills
- `/cases/{id}` — Vignette + discussion + step-gated MCQs

The floating "Ask AI" button is visible on all authenticated pages. Clicking it opens a 420px slide-over panel. Press Escape to close.

### Type checking

```bash
cd frontend && npm run build   # TypeScript check + Vite bundle
```

---

## 5. Files Changed

### New files

| File | What it does |
|---|---|
| `backend/app/schemas/case_question.py` | Three Pydantic models: `CaseQuestionOut` (full question for GET), `CaseAttemptCreate` (POST body: `selected_option` int), `CaseAttemptResult` (POST response: `correct`, `correct_option`, `explanation`). `step` is validated `>= 1` via `Field(ge=1)`. |
| `backend/scripts/seed_case_questions.py` | Inserts 10 clinically authored case questions (2 per case) into `case_questions`. Step 1 asks for most likely diagnosis; step 2 asks for management. Covers: inferior STEMI, new-onset AF, severe aortic stenosis, COPD exacerbation, massive PE. Creates two MongoDB indexes before inserting. Idempotent via pre-query dedup. |
| `frontend/src/api/statsApi.ts` | Typed Axios wrappers for stats endpoints. Exports `DashboardStats` interface and `getDashboardStats()`. |
| `frontend/src/context/AiContext.tsx` | React context (36 lines) providing `open`, `setOpen`, `prefillText`, `openWithText(text)`, and `clearPrefill()` to the entire component tree. `openWithText` formats the pre-fill as `Regarding: "{text}" — ` and opens the panel. Instantiated at router root. |

### Modified files

| File | What changed |
|---|---|
| `backend/app/schemas/stats.py` | Added `DashboardStatsOut`, `LastChapterInfo`, `LastQuestionInfo` models. `weak_topics` uses `Field(default_factory=list)` so missing data never serialises as `null`. |
| `backend/app/api/v1/routes/stats.py` | Added `GET /stats/dashboard` handler. Follows the same Redis cache pattern as existing stats handlers: check cache → call service → set 120s TTL → return. Cache key: `stats:dashboard:{user_id}`. |
| `backend/app/api/v1/routes/cases.py` | Added `GET /{case_id}/questions` (returns `List[CaseQuestionOut]` sorted by step, empty list if none) and `POST /{case_id}/questions/{question_id}/attempt` (validates option, returns result). Both are JWT-protected. 404 is raised only on the attempt endpoint for an unknown question; the list endpoint returns `[]` for a valid case with no questions seeded. |
| `backend/app/services/stats_service.py` | Added `get_dashboard_stats`. Runs three aggregation pipelines: (1) total + correct counts for accuracy and streak, (2) most recent attempt joined to `questions` for `last_question`/`last_chapter`, (3) per-topic accuracy filtered `< 60%` for weak topics. Returns safe zero/null defaults when the user has no history. |
| `frontend/src/pages/DashboardPage.tsx` | Full rewrite to Study Deck layout. Stats bar (streak / questions / accuracy), "Continue" card, "Focus Topics" chips. All three sections have loading skeletons. Empty state when `questions_answered === 0`. 2-column on `lg:`, single column on mobile. |
| `frontend/src/pages/ChaptersPage.tsx` | Full rewrite to Specialty Spine layout. Sticky left sidebar listing all Parts; clicking a Part scrolls and expands its accordion. Debounced 300ms search filters sidebar and accordion content; matched text is bolded. Default state: Part 1 expanded. |
| `frontend/src/pages/SectionDetailPage.tsx` | Full rewrite to open-book two-pane layout (US-007). Left pane is a sticky section TOC; right pane renders `html_content` or plain text. Mobile: TOC collapses into a sticky dropdown. Also implements US-013: `mouseup`/`selectionchange` listeners on the content pane detect text selection, show a floating "Ask AI about this" popover positioned via `getBoundingClientRect`, and call `openWithText()` from `AiContext` on click. |
| `frontend/src/pages/QuestionsPage.tsx` | Full rewrite. Topic card grid at top (accuracy-coloured borders, click to filter the list below), filterable question list below (difficulty, search, URL-persisted topic). Fetches questions in 100-item batches. Pushes `{ questionIds, currentIndex, topic }` into location state when navigating to a question. ~280 lines. |
| `frontend/src/pages/QuestionDetailPage.tsx` | Full rewrite to styled option cards. Options render as full-width clickable cards; after submission the selected card turns red or green, the correct card always turns green, and an explanation panel expands below. "Next Question" button chains to the next question in the filtered set from location state, or falls back to a random question in the same topic. ~224 lines. |
| `frontend/src/pages/CasesPage.tsx` | Full rewrite to card library. Responsive 1–3 column grid, specialty filter pill row, specialty-to-Tailwind-color dictionary with slate fallback, 120-char preview truncation. ~124 lines. |
| `frontend/src/pages/CaseDetailPage.tsx` | Full rewrite. Three-section scroll: Vignette (6 labeled fields), Discussion (management + discussion prose), Questions (step-gated MCQs). Fetches case questions on mount; Questions section hidden if response is `[]`. `unlocked` counter gates visibility: only `questions[0:unlocked+1]` is rendered. Each question card manages its own `{ selected, result, submitting }` state in a `stepStates` array; correct submission increments `unlocked`. ~285 lines. |
| `frontend/src/components/AiChatLauncher.tsx` | Rewired from a simple floating button to a full slide-over controller. Reads `open`, `prefillText`, `openWithText`, `clearPrefill` from `AiContext`. When `open` is true, renders a semi-transparent backdrop overlay and a fixed 420px-wide right-edge panel containing `AssistantChat`. Panel closes on Escape key. Passes `prefillText` and `onPrefillConsumed` (which calls `clearPrefill`) as props to `AssistantChat`. ~56 lines. |
| `frontend/src/components/AssistantChat.tsx` | Added `prefillText` and `onPrefillConsumed` props. A `useEffect` on `prefillText` sets the input, calls `onPrefillConsumed()` to clear context, and auto-focuses the input after 50ms. Retains existing message history, citation rendering, 10-exchange limit, and "New Chat" reset. ~184 lines. |
| `frontend/src/components/AppShell.tsx` | Conditionally renders `AiChatLauncher` only when authenticated and not on login/register routes. No other changes. |
| `frontend/src/components/TopNavbar.tsx` | "AI Assistant" nav link removed. Dashboard, Chapters, Question Bank, Cases links remain. |
| `frontend/src/router.tsx` | `/chat` route removed. `AiContextProvider` added at root so `useAiContext()` is available to all pages. Route tree otherwise unchanged. |

---

## 6. Key Learnings

The `progress.txt` file contained no recorded learnings for this PRD — implementation proceeded against a well-specified PRD without unexpected obstacles.

**Observations derivable from the code:**

- **`last_chapter` via attempt lookup has a gap**: a user who only browses chapters and never answers questions will always see `last_chapter: null`. The PRD acknowledges this and defers a proper `user_activity` upsert to a later story.

- **Redis cache TTL of 120s may feel stale after a quick attempt**: the Study Deck stats won't update until the cache expires. A shorter TTL or explicit cache invalidation on `POST /questions/{id}/attempt` may be worth adding as the product matures.

- **`correct_option` has no max-value validator**: the Pydantic model validates `>= 0` but not `< len(options)`. Admin tooling or bulk imports should validate this at insert time to prevent off-by-one bugs in the UI.

- **Accordion search auto-expansion does not mutate `expandedParts`**: when `searchQuery` is set, `isOpen` is derived purely from `!!searchQuery`. Clearing the search reverts accordions to their pre-search open/closed state. This is intentional — search is a temporary view, not a state mutation.

- **Pre-fill text consumes itself via a callback pattern, not a second context update**: `AiChatLauncher` passes `onPrefillConsumed` → `AssistantChat` calls it after consuming the text → which calls `clearPrefill()` in context. This one-way flow prevents the pre-fill from re-applying if `AssistantChat` re-renders while the panel is still open.

- **Specialty color mapping uses a static dictionary to avoid Tailwind purge issues**: dynamically constructing class names like `bg-${specialty}-100` would be stripped by Tailwind's content scanner. The fixed dictionary ensures all used classes appear literally in the source.

- **Step-gating renders via array slice, not conditional visibility**: `questions.slice(0, unlocked + 1)` means DOM elements for future steps are never mounted until unlocked. This avoids needing to reset per-step state on navigation and keeps the component tree minimal.
