# PRD: CoreMD UI Overhaul — 5 Surfaces

## Introduction

Complete redesign of CoreMD across five surfaces: Dashboard (Study Deck), Chapters (Specialty Spine + Open Book), Question Bank (topic cards with stats + richer UX), Case Studies (Case Library + Vignette/Discussion + multi-step questions), and AI Assistant (ambient floating launcher + inline highlight-to-ask; standalone chat page removed). Based on approved low-fi wireframes. Existing color scheme (slate/blue Tailwind palette) and fonts are preserved throughout.

---

## Goals

- Dashboard surfaces study streak, question accuracy, last activity, and weak-topic recommendations — no reading-progress tracking (users browse chapters freely)
- Chapters use a two-pane specialty-spine layout: left sidebar of Parts (with search) + accordion chapter list; section view is an open-book two-page spread
- Question bank groups questions by topic with per-topic success stats and richer attempt UX
- Case Studies become a clinical-reasoning experience: card library → vignette + discussion + multi-step case questions (step-gated, same page)
- AI is ambient: floating launcher everywhere + text-selection trigger in section pages; no standalone `/chat` route

---

## User Stories

### US-001: Commit all existing local changes
**Description:** As a developer, I need all uncommitted changes (AppShell, TopNavbar, AiChatLauncher, AssistantChat, all page rewrites, route/schema/test fixes, CSS, vite.config) committed to git so every subsequent story has a stable base.

**Acceptance Criteria:**
- [x] `git add` all changed and untracked frontend + backend files
- [x] Commit with message: `feat: add AppShell layout, navigation components, and page scaffolding`
- [x] `git status` shows a clean working tree after the commit
- [x] No deploy (local only)

---

### US-002: Dashboard stats API endpoint
**Description:** As a developer, I need a `GET /api/v1/stats/dashboard` endpoint that returns everything the Study Deck widget needs.

**Acceptance Criteria:**
- [x] Response schema (add to `backend/app/schemas/stats.py`):
  ```json
  {
    "streak_days": 3,
    "questions_answered": 42,
    "accuracy_pct": 71.4,
    "last_chapter": { "id": "ch_001", "title": "The Practice of Medicine" },
    "last_question": { "id": "q_112", "topic": "Cardiology" },
    "weak_topics": ["Nephrology", "Endocrinology"]
  }
  ```
- [x] `streak_days`: count of consecutive calendar days with at least one attempt in `question_attempts`
- [x] `questions_answered`: total attempts by current user
- [x] `accuracy_pct`: (correct attempts / total attempts) × 100, rounded to 1 decimal
- [x] `last_chapter`: most recently fetched chapter from user activity (use a `user_activity` upsert or infer from question attempts via `chapter_ref`); null if none
- [x] `last_question`: question_id + topic of most recent attempt; null if none
- [x] `weak_topics`: topics where user accuracy < 60%, up to 3, sorted by accuracy ascending
- [x] If user has no history: returns zeros / nulls — no 500
- [x] Endpoint protected by `get_current_user`
- [x] Route added to `backend/app/api/v1/routes/stats.py` (or new file if stats.py doesn't exist)
- [x] Typecheck passes

---

### US-003: Case questions — backend schema + API
**Description:** As a developer, I need a `case_questions` MongoDB collection with REST endpoints so the case detail page can serve multi-step clinical reasoning questions.

**Acceptance Criteria:**
- [x] Pydantic schemas in `backend/app/schemas/case_question.py`:
  - `CaseQuestionOut`: `case_question_id`, `case_id`, `step` (int ≥ 1), `stem`, `options` (list[str]), `correct_option` (int), `explanation`
  - `CaseAttemptCreate`: `selected_option` (int)
  - `CaseAttemptResult`: `correct` (bool), `correct_option` (int), `explanation` (str)
- [x] `GET /api/v1/cases/{case_id}/questions` → `List[CaseQuestionOut]` ordered by `step` asc; returns `[]` if none (no 404)
- [x] `POST /api/v1/cases/{case_id}/questions/{question_id}/attempt` → `CaseAttemptResult`
- [x] Both endpoints protected by JWT
- [x] Routes added to `backend/app/api/v1/routes/cases.py`
- [x] Typecheck passes

---

### US-004: Seed sample case questions for first 5 cases
**Description:** As a developer, I need clinically relevant multi-step questions for the first 5 cases in the database so the UI can be built and tested with real data.

**Acceptance Criteria:**
- [x] Script at `backend/scripts/seed_case_questions.py` reads the first 5 `case_id` values from the `cases` collection
- [x] Inserts 2 step-questions per case (step 1 and step 2) with realistic clinical content drawn from each case's `diagnosis`, `specialty`, and `presentation` fields
- [x] Q1 should ask about initial diagnosis / most likely finding; Q2 should ask about management / next step
- [x] Each question has 4 options, `correct_option` (0-indexed), and an explanation paragraph
- [x] Script is idempotent: checks for existing entries and skips duplicates
- [x] After running: `GET /api/v1/cases/{any of 5 case_ids}/questions` returns 2 items
- [x] Script instructions added as a comment at the top of the file

---

### US-005: DashboardPage — Study Deck layout
**Description:** As a user, I want a Study Deck dashboard that shows my activity, accuracy, streak, and weak topic recommendations so I can orient my study session in seconds.

**Acceptance Criteria:**
- [x] Page fetches `GET /api/v1/stats/dashboard` on mount
- [x] Stats bar (horizontal on desktop): **Streak** (🔥 N days), **Questions answered** (N), **Accuracy** (N%)
- [x] "Continue" card: shows last visited chapter (title, link to `/chapters/{id}`) and last attempted question (topic, link to `/questions/{id}`); hidden if both are null
- [x] "Focus topics" section: up to 3 topic chips, each clickable → navigates to `/questions?topic=<topic>`; hidden if `weak_topics` is empty
- [x] Loading skeleton shown while request is in-flight
- [x] Empty state when no history: "Start by reading a chapter or trying a question — your progress will appear here."
- [x] Layout is 2-column on desktop (stats+continue left, focus right), 1-column on mobile
- [x] Typecheck passes
- [x] Verify changes work in browser

---

### US-006: ChaptersPage — Specialty Spine layout
**Description:** As a user, I want a left sidebar listing the book's Parts with a search bar so I can navigate chapters by spine structure using an accordion layout.

**Acceptance Criteria:**
- [x] Two-pane layout: fixed left sidebar (~220px) + scrollable main content
- [x] Sidebar top: text input "Search chapters…" that filters both sidebar and accordion in real time (debounced 300ms)
- [x] Sidebar body: list of Part names (Part 1, Part 2, …); clicking a Part scrolls to and expands that part's accordion; active Part is highlighted
- [x] Main area: Parts as accordion headers showing "Part N · Title (M chapters)"; chapters listed below when expanded
- [x] Chapter rows: chapter number (small muted) + chapter title; clicking navigates to `/chapters/{id}`
- [x] Search: when query is non-empty, only Parts/chapters matching the query (title or number) are visible; matched text is bolded
- [x] Default state: all accordions collapsed, Part 1 expanded
- [x] Typecheck passes
- [x] Verify changes work in browser

---

### US-007: SectionDetailPage — Open book two-page spread
**Description:** As a user reading a section, I want a two-pane open-book layout where the left pane shows the chapter's full section list and the right pane shows the current section's content.

**Acceptance Criteria:**
- [x] Two-column layout: left pane (260px, sticky) = full section TOC for the current chapter; right pane = section content (already rendered HTML)
- [x] TOC items are links (`/chapters/{chapterId}/sections/{sectionId}`); current section is highlighted with accent color and bold
- [x] Right pane: heading shows `chapter_title > section_title`; renders `html_content` if available, falls back to plain text
- [x] Navigating to a different section via TOC updates the right pane without a full page reload (React Router link)
- [x] On mobile (< 768px): left TOC collapses into a sticky "Sections ▾" dropdown at top of right pane
- [x] Typecheck passes
- [x] Verify changes work in browser

---

### US-008: QuestionsPage — topic cards with per-topic stats
**Description:** As a user, I want to see my question-bank topics as stat cards showing my success rate and question count so I immediately see where I need practice.

**Acceptance Criteria:**
- [x] Page layout: topic card grid at top, filterable question list below
- [x] Topic card shows: topic name, total question count, user accuracy % (computed from attempt history or "—" if unattempted)
- [x] Card accent color by accuracy: green border/bg ≥ 70%, yellow 40–69%, red < 40%, neutral grey = unattempted
- [x] Clicking a topic card selects it (highlighted) and filters the question list below to that topic; clicking again deselects (shows all)
- [x] Question list items: stem (truncated to ~100 chars), difficulty badge (Easy/Medium/Hard colored chip), topic chip
- [x] Existing difficulty dropdown and search input still functional alongside topic card selection
- [x] URL reflects selected topic as `?topic=<topic>` so links from Dashboard Focus section work
- [x] Typecheck passes
- [x] Verify changes work in browser

---

### US-009: QuestionDetailPage — richer attempt UX
**Description:** As a user answering a question, I want styled option cards that reveal the correct answer and explanation inline after I submit so the feedback is immediate and clear.

**Acceptance Criteria:**
- [x] Options rendered as full-width clickable cards (not radio buttons)
- [x] Selecting an option highlights it; Submit button activates
- [x] After submission: selected option turns red (if wrong) or green (if correct); correct option always turns green
- [x] Explanation panel expands below the options with the explanation text
- [x] "Next question" button appears after submission; navigates to the next question in the current topic filter (use URL state or fall back to a random unanswered question)
- [x] Question header shows topic chip + difficulty badge
- [x] Typecheck passes
- [x] Verify changes work in browser

---

### US-010: CasesPage — Case Library card grid
**Description:** As a user, I want to browse cases as a visual card grid with specialty badges so I can quickly find relevant clinical scenarios.

**Acceptance Criteria:**
- [x] Page heading reads "Case Studies" (route stays `/cases`)
- [x] Card grid: 3 columns on desktop, 2 on tablet, 1 on mobile
- [x] Each card: case title (bold), specialty badge (color-coded by specialty string), first 120 chars of `presentation` as preview text, a subtle "→" affordance
- [x] Specialty filter: a row of tab/pill buttons at top ("All" + one per distinct specialty); clicking filters the grid
- [x] Clicking a card navigates to `/cases/{id}`
- [x] Typecheck passes
- [x] Verify changes work in browser

---

### US-011: CaseDetailPage — Vignette + discussion + multi-step questions
**Description:** As a user, I want to read a case vignette, see the clinical discussion, and work through step-gated diagnostic questions on the same scrollable page.

**Acceptance Criteria:**
- [x] Single-scroll layout with three sections: **Vignette**, **Discussion**, **Questions**
- [x] Vignette section: fields displayed as labeled blocks — Presentation, History, Physical Exam, Labs, Imaging, Diagnosis
- [x] Discussion section: Management + Discussion fields rendered as prose
- [x] Questions section: fetches `GET /api/v1/cases/{id}/questions`; hidden entirely if response is `[]`
- [x] Questions render as styled MCQ cards (same look as QuestionDetailPage)
- [x] Step-gating: only step 1 is visible initially; after answering step 1 (and seeing explanation), step 2 appears below; and so on
- [x] Each step shows its explanation after answering before unlocking the next step
- [x] Typecheck passes
- [x] Verify changes work in browser

---

### US-012: Remove /chat route; make AI launcher a slide-over panel
**Description:** As a user, I want the AI assistant to be a slide-over panel accessible from any page, not a dedicated route, so I never lose my place.

**Acceptance Criteria:**
- [x] `/chat` route removed from `router.tsx`
- [x] "AI Assistant" nav link removed from `TopNavbar` (and any sidebar)
- [x] `AiChatLauncher` floating button remains visible on all authenticated pages (already in AppShell)
- [x] Clicking the launcher opens a right-side slide-over panel (fixed overlay, ~420px wide on desktop, full-width on mobile) with the existing `AssistantChat` interface inside
- [x] Panel has a close button (×) and closes on Escape key press
- [x] Background page remains visible and non-interactive while panel is open (semi-transparent overlay)
- [x] Typecheck passes
- [x] Verify changes work in browser

---

### US-013: SectionDetailPage — inline highlight → ask AI
**Description:** As a user reading a section, I want to select any text and click "Ask AI" to open the AI panel with that text pre-loaded as context.

**Acceptance Criteria:**
- [x] Selecting text within the section content area (right pane) shows a small floating popover near the selection with a single "Ask AI about this" button
- [x] Clicking the button: opens the AI slide-over panel AND pre-fills the input with `"Regarding: \"[selected text]\" — "` leaving cursor at the end for the user to type their question
- [x] Popover disappears when the selection is cleared or the panel opens
- [x] The popover does not appear outside the content area (e.g. not on TOC or page chrome)
- [x] Typecheck passes
- [x] Verify changes work in browser

---

## Non-Goals

- No reading-progress tracking (chapters are browsed freely; no "mark as read")
- No new PDF ingestion or textbook content changes
- No multi-stage questions in the main Question Bank (cases only)
- No deployment to AWS (commit only — deploy separately on request)
- No dark mode
- No custom domain, SSL cert, or infra changes
- No changes to auth/register pages

---

## Technical Considerations

- **Tailwind CSS**: preserve slate/blue palette; use existing utility classes; no new design tokens
- **AppShell + TopNavbar** already committed (US-001); all stories build on top of this layout
- **AiChatLauncher / AssistantChat** components already exist; US-012 wires them into a slide-over
- **case_questions**: new MongoDB collection — no migration needed, just insert documents
- **Stats**: computed from `question_attempts` collection; `chapter_ref` on questions links to chapters and cases
- **`last_chapter` tracking**: the simplest approach is to upsert a `last_visited_chapter` field on the user document whenever a chapter detail is loaded (one extra PATCH on the backend); alternatively infer from attempts
- **Story ordering**: US-001 → 002 → 003 → 004 (backend complete) → 005–013 (frontend, can be parallelised per surface)
