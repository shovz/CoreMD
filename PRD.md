# PRD: Quick Fixes — Questions, History, Notes Navigation + Selection Highlight

## Introduction

Four UX issues found after the annotation feature shipped: (1) selected text loses its blue highlight while the tooltip is visible; (2) the Question Bank lets users click Next without answering, Previous clears their previous answer, and the score increments on every re-attempt; (3) the Notes page navigates to the top of the chapters page instead of the specific section where the note lives; (4) the History page rows are not clickable — users cannot preview the question stem or case presentation without leaving the page.

## Goals

- Selected text stays highlighted (blue) while the tooltip popover is shown
- Question Bank Previous/Next behaves correctly: Previous restores the stored answer + feedback, Next is blocked until an answer is submitted, score counts only the first attempt per question
- Clicking a note card or chapter title on the Notes page opens the Chapters reader at the exact chapter and section
- Clicking a History row shows a lightweight modal with the question stem (no answer options) or the case Presentation

## User Stories

### US-001: Keep browser selection highlighted while tooltip is visible
**Description:** As a resident, when I select text and the tooltip appears, I want the blue selection highlight to remain visible so I know which text I am about to act on.

**Acceptance Criteria:**
- [x] `frontend/src/index.css` — add `.section-content ::selection { background: #93c5fd; }` so the selection colour stays visible on the warm-paper background
- [x] No JavaScript changes required
- [x] Typecheck passes
- [x] Verify in browser: select text → tooltip appears → selected text still shows blue background

### US-002: Question Bank — correct Prev/Next + first-attempt scoring
**Description:** As a resident, I want Previous to restore my earlier answer and feedback, Next to be blocked until I have answered, and my score to reflect each question's first attempt only.

**Acceptance Criteria:**
- [x] `frontend/src/pages/QuestionsPage.tsx` — add `answeredMapRef = useRef<Map<string, { selectedOption: number; result: AttemptResult }>>(new Map())` (standard mode player only)
- [x] `handleStart` clears the map: `answeredMapRef.current.clear()`
- [x] Question-change `useEffect` checks the map first; if an entry exists, restores `selectedOption` and `attemptResult` from it instead of resetting to null
- [x] `handleOptionClick` — checks `isFirstAttempt = !answeredMapRef.current.has(currentQuestion.question_id)` before incrementing `sessionAnswered` / `sessionCorrect`; stores `{ selectedOption: optionIdx, result: res.data }` in the map after every submission
- [x] Next button `disabled` condition adds `|| !attemptResult`
- [x] Previous button behaviour unchanged except that returning to a previously answered question now shows the stored answer + feedback
- [x] Multi-step mode is not affected (ChainCard has its own local state)
- [x] Typecheck passes
- [x] Verify in browser: answer Q1 → Next → answer Q2 → Previous → Q1 shows previous answer+feedback → score stays 1/1 not 2/2

### US-003: Notes page — navigate to specific chapter + section
**Description:** As a resident, I want clicking a note card or its chapter heading on the Notes page to open the Chapters reader at the exact section where the note was created.

**Acceptance Criteria:**
- [ ] `frontend/src/pages/NotesPage.tsx` — chapter title button navigates with `navigate("/chapters", { state: { chapterId: items[0]?.chapter_id } })` (opens that chapter, first section)
- [ ] Each annotation card becomes clickable (add `onClick`, `cursor-pointer`, hover style) and navigates with `navigate("/chapters", { state: { chapterId: ann.chapter_id, sectionId: ann.section_id } })`
- [ ] The Delete button inside the card still works — its `onClick` must call `e.stopPropagation()` to prevent triggering navigation
- [ ] `ChaptersPage.tsx` reads `location.state` (import `useLocation` from `react-router-dom`); in the initial chapters `useEffect`, if `navState.chapterId` is present call `handleChapterClick(navState.chapterId, navState.sectionId)` and expand that chapter's part; otherwise fall back to the first sorted chapter as before
- [ ] `handleChapterClick(chapterId, targetSectionId?)` — after loading the chapter, finds the section index matching `targetSectionId` (if provided) and loads that section instead of always index 0
- [ ] Typecheck passes
- [ ] Verify in browser: Notes page card click → Chapters page opens with correct chapter expanded and correct section content displayed

### US-004: History page — question and case preview modals
**Description:** As a resident, I want to click a row in my History to see the question stem or case Presentation in a modal without leaving the page.

**Acceptance Criteria:**
- [ ] `frontend/src/pages/HistoryPage.tsx` — add states `previewQuestion: { stem: string } | null` and `previewCase: { title: string; presentation: string } | null` and `casePreviewLoading: boolean`
- [ ] Import `getCaseById` from `../api/casesApi`
- [ ] Questions table rows: add `onClick={() => setPreviewQuestion({ stem: item.stem })}` and `cursor-pointer` class; checkbox `onChange` calls `e.stopPropagation()` to avoid conflict
- [ ] Cases table rows: add `onClick={() => handleCaseRowClick(item)}` and `cursor-pointer`; `handleCaseRowClick` calls `getCaseById(item.case_id)` and stores `{ title, presentation }` in `previewCase`; while loading sets `casePreviewLoading = true`
- [ ] Question preview modal: fixed overlay, shows stem text, closed by clicking × or backdrop
- [ ] Case preview modal: fixed overlay, shows case title + Presentation text, closed by clicking × or backdrop; shows "Loading…" while fetching
- [ ] Checkbox `onChange` on case rows also calls `e.stopPropagation()`
- [ ] Typecheck passes
- [ ] Verify in browser: click question row → modal with stem; click case row → fetches + shows Presentation

## Non-Goals

- No answer options shown in the question preview (stem only)
- No navigation from the preview modal to the question or case page
- No changes to the scoring display format

## Technical Considerations

- `answeredMapRef` is a `useRef` (not `useState`) so map mutations do not trigger re-renders
- `location.state` from `useLocation()` is `unknown` — cast as `{ chapterId?: string; sectionId?: string } | null`
- `ChaptersPage.handleChapterClick` is a declared function (hoisted) so it can be called inside the `useEffect` that runs on mount
- `CaseHistoryItem` does not include `presentation` — a `getCaseById` fetch is required on each case row click
