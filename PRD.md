# PRD: CoreMD UI Overhaul

## Introduction

Complete redesign of the CoreMD frontend based on low-fi wireframes. Five surfaces are
being reshaped: Dashboard (Study Deck), Chapters (Specialty Spine + Open Book), Question
Bank (enriched topic cards), Case Studies (card library + vignette detail with multi-step
clinical questions), and AI Assistant (inline highlight → ask, no dedicated chat page).

The backend receives two additions: streak tracking in the stats service, and a case-steps
schema + API for multi-step clinical questions embedded in each case.

---

## Goals

- Replace all "prototype-looking" page layouts with the wireframe designs
- Add study-streak + weak-topic signals to the Dashboard without reading-progress tracking
- Restructure Chapters into a three-panel specialty-spine layout (parts → chapters → content)
- Enrich the Question Bank with per-topic accuracy stats visible before drilling
- Rename "Clinical Cases" to "Case Studies"; display as a card library
- Show case details as a vignette + sequential multi-step clinical question player
- Allow users to highlight text in a section and instantly ask the AI about it
- Retire the standalone /chat route; AI is only the floating bottom-right launcher

---

## User Stories

---

### US-001: Commit all existing uncommitted local changes

**Description:** As a developer, I need to commit the existing in-progress frontend and
backend changes (AppShell, TopNavbar, AiChatLauncher, page rewrites, route fixes) so the
repository reflects the current working state before the overhaul begins.

**Acceptance Criteria:**
- [ ] Run `git add` on all modified/untracked files listed in `git status`
- [ ] Create a single commit: `chore: commit in-progress UI foundation and route fixes`
- [ ] `git status` shows a clean working tree after the commit
- [ ] Do NOT push or deploy

---

### US-002: Backend — add `current_streak` to overview stats

**Description:** As a user, I want to see how many consecutive days I have answered at
least one question so I can stay motivated.

**Files:** `backend/app/services/stats_service.py`, `backend/app/schemas/stats.py`

**Acceptance Criteria:**
- [ ] `OverviewStatsOut` adds `current_streak: int` field (default 0)
- [ ] `get_overview_stats()` computes streak: count consecutive calendar days (UTC)
  ending on today where `question_attempts` has ≥ 1 document for that user
- [ ] If the user has no attempts today the streak is 0
- [ ] Redis cache key `stats:overview:{user_id}` still used (TTL 120 s)
- [ ] `GET /api/v1/stats/overview` returns the new field
- [ ] Typecheck passes

---

### US-003: Backend — embed `steps` in case documents + seed one case

**Description:** As a developer, I need a case-steps data structure so the UI can render
multi-step clinical questions per case.

**Files:**
- `backend/app/schemas/case.py` — add `CaseStep` and update `CaseOut`
- `backend/scripts/seed_case_steps.py` — one-off seeder for ONE example case
- `backend/app/api/v1/routes/cases.py` — include `steps` in `_doc_to_case_out`

**Schema (embed in case document under field `steps`):**
```python
class CaseStep(BaseModel):
    step_number: int
    question: str
    options: List[str]       # exactly 4 strings
    correct_option: int      # 0-based index
    explanation: str
```

`CaseOut` gets `steps: List[CaseStep] = []`

**Seed script**: connects via `MONGO_URI` from `backend/.env`, finds the first case by
insertion order, upserts 3 realistic clinical-reasoning steps into its `steps` field,
prints the updated `case_id`. Run with: `python backend/scripts/seed_case_steps.py`

**Acceptance Criteria:**
- [ ] `CaseStep` Pydantic model defined in `backend/app/schemas/case.py`
- [ ] `CaseOut` includes `steps: List[CaseStep] = []`
- [ ] `_doc_to_case_out` maps `doc.get("steps", [])` into the response
- [ ] `seed_case_steps.py` exists, runnable, and upserts 3 steps into one case
- [ ] `GET /api/v1/cases/{case_id}` for the seeded case returns `"steps"` with 3 items
- [ ] Typecheck passes

---

### US-004: Backend — case step attempt endpoint

**Description:** As a user, I want to submit my answer for a case step and receive
immediate feedback (correct/incorrect + explanation).

**File:** `backend/app/api/v1/routes/cases.py`

**New endpoint:** `POST /cases/{case_id}/steps/{step_number}/attempt`
- Request body: `{ "selected_option": 0 }` (int, 0-based)
- Response: `{ "correct": bool, "correct_option": int, "explanation": str }`
- 404 if case not found or `step_number` not present in `steps`
- Stateless — does not persist to DB

**Acceptance Criteria:**
- [ ] Endpoint registered and reachable at the correct URL
- [ ] Returns `correct: true` when `selected_option == correct_option`
- [ ] Returns `correct: false` otherwise
- [ ] Returns HTTP 404 when case or step is missing
- [ ] Typecheck passes

---

### US-005: Dashboard — Study Deck redesign

**Description:** As a user, I want a rich Study Deck dashboard showing my streak, question
stats, weak topics, and performance charts — without any reading-progress tracking.

**File:** `frontend/src/pages/DashboardPage.tsx`

**Layout (single column, max-w-4xl, space-y-6):**

**Row 1 — Three stat tiles (grid-cols-3):**
- Tile 1: `current_streak` + label "Day Streak" (show flame emoji or simple icon)
- Tile 2: `total_questions_answered` + label "Questions Answered"
- Tile 3: `correct_percentage.toFixed(1) + "%"` + label "Accuracy"

**Row 2 — "Needs Work" section (only when ≥ 1 attempt exists):**
- Heading "Needs Work"
- Take `by_topic` sorted by `accuracy` ascending, slice first 3
- Display as horizontal pills: topic name + `XX%` badge

**Row 3 — AccuracyBarChart "Performance by Difficulty"** (existing component)

**Row 4 — AccuracyBarChart "Performance by Specialty"** — pass top 8 topics sorted by
`attempted` descending

**Empty state** (zero attempts): centered card "Head to Question Bank to get started →"

Remove the `StatCard` for "Chapters Covered" (we do not track reading progress).

**Acceptance Criteria:**
- [ ] Streak tile shows `overview.current_streak` as "N Day Streak"
- [ ] "Chapters Covered" stat tile removed
- [ ] "Needs Work" section with bottom-3 topics visible when attempts exist
- [ ] Both AccuracyBarChart rows render correctly
- [ ] Empty state shown when `total_questions_answered === 0`
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### US-006: Questions page — topic cards with accuracy stats

**Description:** As a user, I want to see my accuracy and attempt count on each topic card
before I start drilling, so I know where to focus.

**Files:** `frontend/src/pages/QuestionsPage.tsx`

**Changes:**
- In the initial `useEffect`, fetch `getQuestionStats()` in parallel with `getQuestionTopics()`
- Build `topicStatsMap: Map<string, {accuracy: number, attempted: number}>` from
  `questionStats.by_topic`
- Below the topic name on each card show:
  - `attempted > 0`: `"XX.X% · N attempted"` in muted small text
  - `attempted === 0`: `"Not started"` in muted small text
- Card left-border color:
  - `accuracy >= 70` → `border-l-4 border-l-emerald-500`
  - `40 <= accuracy < 70` → `border-l-4 border-l-amber-500`
  - `accuracy < 40 && attempted > 0` → `border-l-4 border-l-rose-500`
  - `attempted === 0` → no colored border

**Acceptance Criteria:**
- [ ] `getQuestionStats()` called on mount alongside topics
- [ ] Stats displayed on each topic card with correct values
- [ ] Left-border coloring applied per accuracy tier
- [ ] Question player (answering, next/prev, random mode) has no regressions
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### US-007: Chapters page — specialty spine three-panel layout

**Description:** As a user, I want a parts sidebar (with search above it) so I can jump
to any specialty and see its chapters as an accordion.

**File:** `frontend/src/pages/ChaptersPage.tsx`

**New layout (`flex flex-row h-full`):**

```
┌──────────────┬────────────────────────────────┐
│  LEFT PANEL  │  MAIN AREA                     │
│  w-56 fixed  │                                │
│  [Search…]   │  Accordion: chapters in        │
│  ──────────  │  the selected part             │
│  Part 1 ●    │                                │
│  Part 2      │  OR: search results list       │
│  Part 3      │  (when search is non-empty)    │
│  ...         │                                │
└──────────────┴────────────────────────────────┘
```

- Left sidebar (`w-56 shrink-0 border-r overflow-y-auto sticky top-20 h-[calc(100vh-5rem)]`):
  - Search `<input>` at top (reuses existing `searchChapters` debounce logic)
  - Below: scrollable list of part buttons (`Part N: Title`) — click selects that part
  - Selected part: `bg-blue-600 text-white` style
- Main area (`flex-1 overflow-y-auto`):
  - When search is empty: show chapter accordion for the selected part only (not all parts)
    - Chapters sorted by `chapter_number`; each is a `<details>` or button that expands
      to show section links → each section links to `/chapters/{ch.id}/sections/{s.id}`
    - Chapter header links to `/chapters/{ch.id}` as well
  - When search is non-empty: show the search results list (same card style as before)
- Default selected part: first part in `sortedParts`
- Remove the old "all-parts" accordion rendering

**Acceptance Criteria:**
- [ ] Left sidebar lists all parts; clicking one filters the main area to that part's chapters
- [ ] Search input at top of sidebar, results override accordion when non-empty
- [ ] First part selected by default on load
- [ ] Each chapter row links to `/chapters/{ch.id}`
- [ ] Sections within an expanded chapter link to `/chapters/{ch.id}/sections/{s.id}`
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### US-008: Chapter detail — open book two-column layout

**Description:** As a user, when I open a chapter I want to see the section list on the
left and read section content on the right without navigating to a separate page.

**File:** `frontend/src/pages/ChapterDetailPage.tsx`

**New layout (`flex flex-row` full height):**

```
┌──────────────────────┬──────────────────────────────┐
│  LEFT: Section list  │  RIGHT: Section content      │
│  w-64 border-r       │  flex-1 overflow-y-auto      │
│                      │                              │
│  ← Back to Chapters  │  [breadcrumb]                │
│  Chapter title       │  Section HTML rendered here  │
│  ─────────────────   │                              │
│  § Section 1  ●      │                              │
│  § Section 2         │                              │
│  ...                 │                              │
└──────────────────────┴──────────────────────────────┘
```

- Left panel (`w-64 shrink-0 border-r overflow-y-auto sticky top-20 h-[calc(100vh-5rem)]`):
  - "← Chapters" back link at top
  - Chapter title + chapter number
  - List of sections; clicking one sets `activeSectionId` state and fetches content
  - Active section: highlighted with `bg-blue-50 text-blue-700`
- Right panel (`flex-1 overflow-y-auto p-6 prose max-w-none`):
  - On mount: auto-select first section and fetch its content via `getSectionById`
  - Renders `sanitizedHtml` with DOMPurify + image URL rewrite (copy from SectionDetailPage)
  - Loading state: "Loading section…"
- The existing `SectionDetailPage` at `/chapters/:chapterId/sections/:sectionId` is kept
  intact for direct URL access

**Acceptance Criteria:**
- [ ] Two-column layout renders correctly
- [ ] First section is selected and its content loaded on mount
- [ ] Clicking a section in the left list loads its content in the right panel
- [ ] Selected section is highlighted
- [ ] DOMPurify + image URL rewrite applied
- [ ] "← Chapters" link navigates to `/chapters`
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### US-009: Cases page — card library + rename

**Description:** As a user, I want to browse cases as a card grid and quickly filter by
specialty; the section should be called "Case Studies".

**Files:**
- `frontend/src/pages/CasesPage.tsx`
- `frontend/src/components/TopNavbar.tsx` — "Cases" label → "Case Studies"

**Layout:**
- Page heading: `Case Studies`
- Specialty filter: horizontal chip row (`All` + one chip per specialty); selected chip
  uses `bg-blue-600 text-white`
- Card grid: `grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Each card:
  - 4px left border in specialty color (from `SPECIALTY_COLORS`)
  - Specialty chip (top-right)
  - Case title (bold)
  - `"Open Case →"` link button → `/cases/{case_id}`

**Acceptance Criteria:**
- [ ] Heading shows "Case Studies"
- [ ] TopNavbar label updated to "Case Studies"
- [ ] Specialty filter uses chip buttons
- [ ] Cards display specialty color bar + title + specialty chip + "Open Case →"
- [ ] Filtering by specialty shows only matching cases
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### US-010: Case detail — vignette layout

**Description:** As a user, I want to read the case as a structured clinical vignette on
the left, with discussion and questions on the right.

**File:** `frontend/src/pages/CaseDetailPage.tsx`

**Layout (`flex flex-col lg:flex-row gap-6`):**

Left column (`lg:w-1/2`):
- "← Case Studies" breadcrumb
- Card per vignette section, each is an open `<details>` by default:
  - Presentation, History, Physical Examination, Labs, Imaging
- Spoiler `<details>` closed by default: Diagnosis, Management
- Optional: chapter reference link if `chapter_title` is set

Right column (`lg:w-1/2`):
- "Discussion" heading + `case.discussion` text
- Horizontal divider
- `<CaseQuestionPlayer caseId={case.case_id} steps={case.steps ?? []} />`
  (component created in US-011; just import + render it here, no crash if empty)

**Acceptance Criteria:**
- [ ] Two-column layout (stacked on mobile)
- [ ] Five vignette sections open by default in `<details>` elements
- [ ] Diagnosis + Management in a separate closed `<details>`
- [ ] Discussion text renders in right column
- [ ] `<CaseQuestionPlayer>` renders without crashing (may show empty state)
- [ ] Breadcrumb navigates to `/cases`
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### US-011: Case detail — multi-step question player

**Description:** As a user, I want to answer a sequence of clinical questions about the
case — one step at a time, with feedback after each — without leaving the page.

**Files:**
- `frontend/src/components/CaseQuestionPlayer.tsx` (new)
- `frontend/src/api/casesApi.ts` (add `CaseStep` type + `submitCaseStepAttempt`)

**`CaseStep` type (add to `casesApi.ts`):**
```typescript
export interface CaseStep {
  step_number: number;
  question: string;
  options: string[];
  correct_option: number;
  explanation: string;
}
```

**`submitCaseStepAttempt(caseId, stepNumber, selectedOption)` → `POST /cases/{caseId}/steps/{stepNumber}/attempt`**

**`CaseQuestionPlayer` props:** `{ caseId: string; steps: CaseStep[] }`

**Behavior:**
- Empty state: `steps.length === 0` → muted text "No clinical questions for this case."
- Render completed steps as a slim summary row (step N · ✓ or ✗)
- Current step: show question text + 4 option buttons (A/B/C/D)
- On option click: call API; show green/red feedback + explanation
- "Next →" button after feedback; last step shows "Case Complete" summary card showing N/M correct
- Once answered, a step cannot be changed

**Acceptance Criteria:**
- [ ] Component file exists at `frontend/src/components/CaseQuestionPlayer.tsx`
- [ ] Empty state text shown when `steps` is empty
- [ ] Steps render sequentially; answered steps show summary row
- [ ] Option selection calls `submitCaseStepAttempt` and shows feedback
- [ ] "Next →" advances to the next step
- [ ] Completion card appears after all steps answered
- [ ] `casesApi.ts` has `CaseStep` type and `submitCaseStepAttempt` function
- [ ] Typecheck passes
- [ ] Verify changes work in browser using the seeded case from US-003

---

### US-012: AI inline highlight → ask (section detail page)

**Description:** As a user reading a section, I want to select any text and click "Ask AI"
to send it directly to the AI assistant without losing my place.

**Files:**
- `frontend/src/context/AiContext.tsx` (new)
- `frontend/src/components/AppShell.tsx` (wrap with AiContext provider)
- `frontend/src/components/AiChatLauncher.tsx` (consume context, auto-open + prefill)
- `frontend/src/components/AssistantChat.tsx` (accept `initialText` prop to prefill input)
- `frontend/src/pages/SectionDetailPage.tsx` (selection listener + floating button)

**`AiContext`:** `{ prefillText: string | null; setPrefillText: (t: string | null) => void }`

**`SectionDetailPage` changes:**
- Add `useRef` on the section content container div (`contentRef`)
- `useEffect` registers `document.addEventListener("selectionchange", handler)` and cleans
  up on unmount
- Handler: check `window.getSelection()?.toString().trim()`; if length ≥ 10 AND the
  selection is contained within `contentRef.current`, show the floating button
- Floating button: absolute positioned near the selection (use `getBoundingClientRect` of
  the selection range); label "Ask AI ✦"; click → `setPrefillText(selectedText)`; clear
  highlight state

**`AiChatLauncher` changes:**
- Consume `prefillText` from context
- `useEffect` on `prefillText`: when non-null, set `open = true` and pass text to child

**`AssistantChat` changes:**
- Accept `initialText?: string` prop; when set, prefill the chat input on mount

**Acceptance Criteria:**
- [ ] `AiContext.tsx` created; `AppShell` wraps children in `<AiContextProvider>`
- [ ] Selecting ≥ 10 characters inside the section content area shows floating "Ask AI ✦"
- [ ] Clicking opens the AI chat panel with the selected text pre-filled
- [ ] Deselecting text hides the button
- [ ] Feature does not appear on other pages
- [ ] No memory leak (event listener cleaned up)
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### US-013: Remove /chat page and clean up nav

**Description:** As a developer, I want to remove the standalone chat page since AI is
now accessed only via the floating launcher and inline highlight.

**Files:**
- `frontend/src/router.tsx` — remove `/chat` route + `ChatPage` import
- `frontend/src/components/TopNavbar.tsx` — remove "AI Assistant" nav link if it links to `/chat`
- `frontend/src/pages/ChatPage.tsx` — delete the file

**Acceptance Criteria:**
- [ ] `/chat` route entry removed from `router.tsx`
- [ ] `ChatPage` import removed from `router.tsx`
- [ ] `ChatPage.tsx` file deleted
- [ ] No TypeScript errors from dangling imports
- [ ] TopNavbar has no link pointing to `/chat`
- [ ] Navigating to `/chat` in browser falls through to the root/login route
- [ ] Typecheck passes

---

## Non-Goals

- No reading-progress tracking (chapters read, time on page)
- No user settings or profile page changes
- No new data import or PDF re-extraction
- No deployment — user will trigger deploy manually after reviewing
- No Route 53 / custom domain
- No pagination for the case question player (all steps on one page)
- No persisting case step answers to the database (stateless for MVP)

---

## Technical Considerations

- **Color palette / fonts**: Tailwind slate/blue throughout; no new design tokens
- **Existing reusable components**: `StatCard`, `AccuracyBarChart`, `AppShell`,
  `TopNavbar`, `AiChatLauncher`, `AssistantChat`
- **Stats already available**: `/api/v1/stats/questions` returns `by_topic[]` with
  `accuracy` + `attempted`; `/api/v1/stats/overview` returns question counts (streak
  added in US-002)
- **Section HTML rendering**: reuse DOMPurify + image-URL rewrite from
  `SectionDetailPage.tsx` lines 32–39
- **Case steps are stateless**: no DB writes for step attempts (acceptable MVP)
- **`selectionchange` listener**: must be cleaned up in `useEffect` return to prevent
  memory leaks
- **Story order matters**: US-001 → US-002/US-003/US-004 (backend) → US-005 through
  US-013 (frontend); frontend stories can mostly run in any order except US-011 depends
  on US-010, and US-012 depends on AppShell being correct
