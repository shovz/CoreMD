# PRD: CoreMD UI Revision — Layout, Theme, Chapters, Questions, Cases

## Introduction

Six targeted corrections to the previous implementation: (1) replace top navbar with a left sidebar, (2) apply a warm paper/ink color theme, (3) restore stats charts to the dashboard, (4) merge the chapters experience into a single all-in-one view with a secondary parts sidebar and inline book reader, (5) restore topic-cards + random question layout and add inline multi-step follow-up questions, and (6) generate realistic clinical cases via OpenAI.

---

## Goals

- Every page uses a left sidebar for navigation (no top navbar)
- Warm paper/ink palette applied globally via CSS variables
- Dashboard shows both the Study Deck widgets and the stats charts
- Chapters: one page, no routing — secondary sidebar (parts accordion) + book reader (prev/next sections)
- Question Bank: topic cards + "Random Question" card + inline follow-up on correct answer
- Cases collection populated with 20 AI-generated cases covering 8 specialties

---

## User Stories

### US-001: Paper/ink CSS variables + body background
**Description:** As a developer, I need global CSS variables for the warm paper/ink palette so every subsequent story can reference them.

**Acceptance Criteria:**
- [x] Add to `:root` in `frontend/src/index.css`: `--paper: #faf8f4`, `--paper-2: #f0ede6`, `--ink: #1a1814`, `--ink-dim: #6b6760`, `--ink-4: rgba(26,24,20,0.08)`, `--accent: #2563eb`
- [x] `body` background changed to `var(--paper)` (replaces current slate-50 gradient)
- [x] `npm run build` passes

---

### US-002: Left sidebar — replace TopNavbar
**Description:** As a user, I want a left sidebar for navigation instead of a top bar so the layout matches the wireframe.

**Acceptance Criteria:**
- [ ] New file `frontend/src/components/Sidebar.tsx` created
- [ ] Sidebar is ~220px wide, fixed height full-screen, `bg-[var(--paper-2)]`, right border `1px solid var(--ink-4)`
- [ ] Logo area at top: bold "CoreMD" with accent-colored dot
- [ ] Nav items: Dashboard, Chapters, Question Bank, Cases — each with an icon and label
- [ ] Active nav item: `bg-blue-600 text-white`; inactive: `text-[var(--ink-dim)] hover:bg-[var(--ink-4)] hover:text-[var(--ink)]`
- [ ] Bottom of sidebar: "Ask AI" button that calls `useAiContext().setOpen(true)`
- [ ] `AppShell.tsx` updated: `flex flex-row h-screen` — `<Sidebar />` on left, `<main className="flex-1 overflow-y-auto h-screen">` on right
- [ ] `TopNavbar` no longer rendered in AppShell
- [ ] Mobile (< 768px): sidebar hidden; hamburger `☰` button shown top-left of main area; clicking toggles a fixed slide-in drawer with overlay
- [ ] `npm run build` passes
- [ ] Verify changes work in browser

---

### US-003: Dashboard — add stats charts section
**Description:** As a user, I want to see my performance charts below the Study Deck so I have a full picture of my progress.

**Acceptance Criteria:**
- [ ] `DashboardPage.tsx` also calls `GET /api/v1/stats` (existing endpoint returning `by_difficulty` and `by_topic`); add `getStats()` to `frontend/src/api/statsApi.ts` if it doesn't exist
- [ ] Below the existing Study Deck section, add a "Performance" section with two cards side-by-side on desktop:
  - **Difficulty breakdown card**: rows for Easy / Medium / Hard, each showing attempted count + CSS progress bar for accuracy %
  - **Topics breakdown card**: up to 8 topics sorted by accuracy % desc, each as a labeled horizontal bar row
- [ ] Both cards show skeleton while loading; "No data yet — start answering questions" if no attempts
- [ ] `npm run build` passes
- [ ] Verify changes work in browser

---

### US-004: Chapters — all-in-one view (secondary sidebar + inline book reader)
**Description:** As a user, I want to browse parts/chapters and read sections without leaving the chapters page — the secondary sidebar shows the parts accordion and the book area shows section content with prev/next navigation.

**Acceptance Criteria:**
- [ ] `ChaptersPage.tsx` fully rewritten as a two-pane layout (within the main content area, i.e. to the right of the main Sidebar):
  - **Left pane** (~260px, sticky full-height): search input at top; Parts list as accordion — clicking a part expands its chapters below it; clicking same part again collapses; only one part open at a time
  - **Right pane** (flex-1): book reader area
- [ ] When a chapter is clicked: fetch `getChapterById(id)`, set `currentSectionIndex = 0`, fetch `getSectionById(chapterId, sections[0].id)`, display content
- [ ] Book reader right pane shows: chapter + section heading, section content via `dangerouslySetInnerHTML` with DOMPurify, Prev / Next buttons at bottom, "Section N of M" counter; Prev/Next disabled at boundaries
- [ ] No React Router navigation when selecting chapters/sections — all state is local to ChaptersPage
- [ ] Text selection in the right pane shows "Ask AI about this" popover (reuse `useAiContext` + `openWithText` from SectionDetailPage)
- [ ] Empty state shown in right pane when no chapter selected: "Select a chapter from the left to start reading"
- [ ] Existing routes `/chapters/:chapterId` and `/chapters/:chapterId/sections/:sectionId` still work in router.tsx as deep links
- [ ] `npm run build` passes
- [ ] Verify changes work in browser

---

### US-005: Questions — restore topic cards + add Random Question card
**Description:** As a user, I want to see topic cards with my accuracy stats and a "Random Question" card so I can quickly jump into practice.

**Acceptance Criteria:**
- [ ] `QuestionsPage.tsx` topic grid retains the existing accuracy-colored cards
- [ ] A **"Random Question"** card is the first item in the topic grid: dashed border, "🎲 Random" label, "Any topic" subtitle, neutral styling
- [ ] Clicking Random Question: picks a random question from the full `questions` array and navigates to `/questions/{id}` with `state = { questionIds: allIds, currentIndex: randomIndex, topic: null }`
- [ ] All other existing behavior (topic filter, difficulty dropdown, search, question list) unchanged
- [ ] `npm run build` passes
- [ ] Verify changes work in browser

---

### US-006: Questions — inline multi-step follow-up on correct answer
**Description:** As a user, when I answer correctly I want a follow-up question to appear below so I can keep practicing without navigating away.

**Acceptance Criteria:**
- [ ] `QuestionDetailPage.tsx`: after a **correct** answer, a follow-up question card is appended inline below (fetched via `getQuestions({ topic, limit: 10 })`, random pick excluding current `question_id`)
- [ ] Follow-up card is rendered identically (option cards, submit, explanation)
- [ ] If follow-up also answered correctly, a third appears; **chain capped at 3 follow-ups** per page visit
- [ ] If any follow-up answered **incorrectly**, chain ends (no more follow-ups)
- [ ] "Next Question →" button only appears at the end of the chain or after an incorrect answer
- [ ] State: `followUps: Array<{ question: QuestionFull; result: AttemptResult | null }>`
- [ ] `npm run build` passes
- [ ] Verify changes work in browser

---

### US-007: Generate 20 clinical cases with OpenAI
**Description:** As a developer, I need a script that uses OpenAI to generate and insert 20 realistic clinical cases (with 2 step-questions each) so the Cases page has real content.

**Acceptance Criteria:**
- [ ] Script at `backend/scripts/generate_cases.py` reads `OPENAI_API_KEY` and `MONGO_URI` from `backend/.env`
- [ ] Checks existing case count; generates only enough new cases to reach 20 total (idempotent)
- [ ] Each case calls `openai.chat.completions.create` (model `gpt-4o`) with a structured prompt returning JSON matching: `case_id, title, specialty, presentation, history, physical_exam, labs, imaging, diagnosis, management, discussion, chapter_ref=null`
- [ ] Covers all 8 specialties: Cardiology, Pulmonology, Nephrology, Gastroenterology, Endocrinology, Hematology, Infectious Disease, Neurology
- [ ] For each case, inserts 2 `case_questions` documents (step 1 = diagnosis question, step 2 = management question), each with 4 options and explanation
- [ ] Script prints: `Generating case N/20: <title>` for each new case
- [ ] Script is idempotent: skips `case_id` values already in the collection
- [ ] Usage instructions in top-of-file comment
- [ ] After running: `db.cases.count_documents({})` ≥ 20

---

## Non-Goals

- No AWS deployment (commit only — deploy separately on request)
- No changes to auth/register pages
- No dark mode
- No new backend API endpoints beyond what's listed above
- No changes to the AI panel internals

---

## Technical Considerations

- CSS variables from US-001 used as `bg-[var(--paper)]` etc. in Tailwind arbitrary values
- `getSectionById(chapterId, sectionId)` and `getChapterById(id)` already exist in `chaptersApi.ts`
- `DOMPurify` already imported in `SectionDetailPage.tsx` — same pattern in ChaptersPage
- `useAiContext` + `openWithText` pattern already in `SectionDetailPage.tsx`
- `GET /api/v1/stats` already exists; may need `getStats()` added to `statsApi.ts`
- Story order: US-001 → US-002 → US-003 → US-004 → US-005 → US-006 → US-007
