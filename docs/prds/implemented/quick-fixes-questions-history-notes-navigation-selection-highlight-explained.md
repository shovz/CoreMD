# Quick Fixes: Questions, History, Notes Navigation + Selection Highlight — Implementation Explained

## What Was Implemented and Why

Four UX issues were identified after the annotation feature shipped and grouped into a single PRD because each fix is small and self-contained. All four are now complete.

**US-001 — Selection highlight disappears while tooltip is visible**
When a user selects text in the chapter reader, the browser's native blue selection highlight vanishes the moment the tooltip popover appears. This happens because the warm-paper background colour of `.section-content` overrides the platform-default selection colour. A single CSS rule restores it.

**US-002 — Question Bank: incorrect Prev/Next and double-counting score**
Three related bugs existed in the standard-mode player inside `QuestionsPage`:
- Clicking Next was allowed before answering, advancing without recording an answer.
- Clicking Previous reset the question to a blank state, discarding the already-submitted answer.
- Re-visiting and re-answering via Previous incremented `sessionAnswered` and `sessionCorrect` a second time, inflating the score.

All three stem from the same root cause: there was no in-memory record of which questions had already been answered in the current session.

**US-003 — Notes page: navigate to specific chapter/section**
Clicking a note card or chapter heading on the Notes page previously opened the Chapters reader at the top of the first chapter, ignoring which chapter or section the note belonged to. The fix passes `chapterId` and `sectionId` through React Router's `location.state` and reads them in `ChaptersPage` on mount.

**US-004 — History page: question/case preview modals**
History table rows were not clickable. Users had to navigate away from the page to review a question stem or a case Presentation. The fix adds lightweight fixed-position modals: question stems display immediately from row data already in memory; case Presentations are fetched on demand via `getCaseById`.

---

## Key Design Decisions

### US-001: CSS-only fix, no JavaScript

The browser's native `::selection` pseudo-element colour is overridden by the parent element's background. The fix adds a scoped rule:

```css
.section-content ::selection {
  background: #93c5fd;
}
```

`#93c5fd` is Tailwind's `blue-300` — the same colour class used elsewhere in the UI for selected/active states, so the highlight blends with the design system. Scoping to `.section-content` (rather than `*` or `body`) means only the chapter reading area is affected; the rest of the app retains its default selection colour.

The tooltip popover does not disturb the selection range itself — only the visual highlight was lost, so no JavaScript is needed.

### US-002: `useRef` map for answer persistence, not `useState`

A `Map<string, { selectedOption: number; result: AttemptResult }>` keyed by `question_id` is stored in a `useRef` rather than a `useState`. The distinction matters:

- `useState` would cause a re-render on every map mutation (every submission, every navigation). The map is a cache, not a rendering input — re-renders are unnecessary and could interfere with existing animation/transition logic.
- `useRef` mutations are synchronous and invisible to React's reconciler. The component reads from the map inside effects and event handlers; writes happen inside `handleOptionClick` after a successful API response.

The map is cleared in `handleStart` (when the user starts a new session).

**Score guard — `isFirstAttempt`**

```ts
const isFirstAttempt = !answeredMapRef.current.has(currentQuestion.question_id);
```

This flag is captured *before* the `await submitAttempt(...)` call. The map is only populated after a successful response, so `isFirstAttempt` is `true` on the first submission and `false` on all subsequent re-visits. Capturing it before the `await` also prevents a race condition where a rapid double-click could register two first-attempt increments for the same question.

**Next button guard**

```tsx
disabled={playerIndex >= questionPool.length - 1 || !attemptResult}
```

`!attemptResult` blocks Next until the current question has been answered. Because `attemptResult` is restored from the map when navigating back, a previously answered question does not re-block Next.

Multi-step mode is unaffected. `ChainCard` has its own local component state and was not changed.

### US-003: React Router `location.state` as a one-shot navigation payload

Rather than URL query parameters or a shared store, `chapterId` and `sectionId` are passed via React Router's second `navigate` argument `{ state: ... }`. This keeps the URL clean and avoids any persistent global state. The state is consumed once by `ChaptersPage` on mount; navigating away discards it naturally.

`location.state` is typed as `unknown` in React Router, so it is cast:

```ts
const navState = (location.state ?? {}) as { chapterId?: string; sectionId?: string };
```

The chapter heading button on Notes page only carries `chapterId` (opens the chapter at its first section). Individual annotation cards carry both `chapterId` and `sectionId` (opens the exact section).

The Delete button inside each annotation card calls `e.stopPropagation()` so clicking it does not simultaneously trigger the card's navigation handler.

### US-004: `getCaseById` on demand — question stems are free

Question stems are already present in the `AttemptHistoryItem` rows returned by the history API (`item.stem`). Clicking a question row opens a modal immediately with no network call — the data is already in memory.

Case Presentations are not included in `CaseHistoryItem` (the history list endpoint returns only metadata), so `getCaseById` is called on each case row click. A `casePreviewLoading` boolean shows a "Loading…" placeholder while the fetch is in flight.

Both modals use the same pattern — a fixed overlay that closes when the backdrop is clicked or the `×` button is pressed:

```tsx
<div className="fixed inset-0 z-50 ..." onClick={() => setPreviewQuestion(null)}>
  <div ... onClick={(e) => e.stopPropagation()}>
    {/* content */}
  </div>
</div>
```

The inner panel calls `e.stopPropagation()` so clicking inside the modal does not close it.

---

## MongoDB Document Shapes Produced

None of these changes write to MongoDB.

- US-001 is a CSS change.
- US-002 stores session state only in a `useRef`, discarded on component unmount.
- US-003 reads existing chapter and section documents; no writes.
- US-004 reads existing case documents via `getCaseById`; no writes.

No new collections, fields, or indexes are introduced.

---

## How to Run / Verify

Start the frontend dev server:

```bash
cd frontend
npm run dev     # Vite on :5173
```

The backend must be running for US-002, US-003, and US-004 (all make API calls):

```bash
cd backend
python -m uvicorn app.main:app --reload   # FastAPI on :8000
```

**Verify US-001 (selection highlight):**
1. Open the Chapters reader and navigate to any section.
2. Click and drag to select a passage of text.
3. The tooltip appears — the blue highlight must remain visible on the selected text throughout.

**Verify US-002 (Prev/Next + score):**
1. Start a Question Bank session (standard mode, any topic).
2. Try clicking Next before answering — the button must be disabled.
3. Answer Q1 correctly. Score shows 1/1. Click Next.
4. Answer Q2. Click Previous.
5. Q1 must reappear with the original answer highlighted and the feedback banner visible. Score remains 1/1, not 2/2.
6. Click Next — Q2 must appear with its stored answer and feedback.

**Verify US-003 (Notes → Chapters navigation):**
1. Create a note on a non-first section of any chapter.
2. Navigate to the Notes page.
3. Click the chapter heading button — the Chapters reader must open with that chapter expanded and its first section loaded.
4. Go back to Notes; click the annotation card itself — the Chapters reader must open with the exact section where the note was created.
5. Click Delete on the annotation card — the note must be deleted without navigating away.

**Verify US-004 (History modals):**
1. Open the History page, Questions tab.
2. Click any row (not the checkbox) — a modal must appear with the question stem text.
3. Click the backdrop or × to close.
4. Switch to the Cases tab and click any row — a "Loading…" placeholder must appear briefly, then the case title and Presentation text.
5. Clicking the checkbox on any row must toggle selection without opening the modal.

TypeScript check:

```bash
cd frontend
npm run build   # tsc + vite build — must pass with no errors
```

---

## Files Changed

| File | What changed |
|------|-------------|
| `frontend/src/index.css` | Added `::selection` rule scoped to `.section-content` |
| `frontend/src/pages/QuestionsPage.tsx` | Added `answeredMapRef`, updated question-change effect, `handleOptionClick`, Next `disabled` condition, and `handleStart` |
| `frontend/src/pages/NotesPage.tsx` | Chapter heading button and annotation cards now navigate with `chapterId`/`sectionId` state; Delete button calls `stopPropagation` |
| `frontend/src/pages/ChaptersPage.tsx` | Reads `location.state` on mount; `handleChapterClick` accepts optional `targetSectionId` and opens the matching section |
| `frontend/src/pages/HistoryPage.tsx` | Added `previewQuestion`, `previewCase`, `casePreviewLoading` state; question/case rows are clickable; two modal overlays rendered at the bottom of the page |

### `frontend/src/index.css`

Four lines added after the existing `.section-content` block:

```css
.section-content ::selection {
  background: #93c5fd;
}
```

### `frontend/src/pages/QuestionsPage.tsx`

**New ref (standard mode player)**

```ts
const answeredMapRef = useRef<Map<string, { selectedOption: number; result: AttemptResult }>>(new Map());
```

**Question-change `useEffect` — restore from map if available**

```ts
const stored = answeredMapRef.current.get(currentQuestion?.question_id ?? "");
if (stored) {
  setSelectedOption(stored.selectedOption);
  setAttemptResult(stored.result);
} else {
  setSelectedOption(null);
  setAttemptResult(null);
}
```

**`handleOptionClick` — first-attempt guard and map write**

```ts
const isFirstAttempt = !answeredMapRef.current.has(currentQuestion.question_id);
// ... await submitAttempt ...
if (isFirstAttempt) {
  setSessionAnswered((n) => n + 1);
  if (res.data.correct) setSessionCorrect((n) => n + 1);
}
answeredMapRef.current.set(currentQuestion.question_id, { selectedOption: optionIdx, result: res.data });
```

**Next button `disabled` condition**

```tsx
// Before
disabled={playerIndex >= questionPool.length - 1}
// After
disabled={playerIndex >= questionPool.length - 1 || !attemptResult}
```

**`handleStart` — clear the map**

```ts
answeredMapRef.current.clear();
```

### `frontend/src/pages/NotesPage.tsx`

Chapter heading button now passes `chapterId`:

```tsx
onClick={() => navigate("/chapters", { state: { chapterId: items[0]?.chapter_id } })}
```

Annotation card `div` becomes clickable with hover style and navigates with both IDs:

```tsx
onClick={() => navigate("/chapters", { state: { chapterId: ann.chapter_id, sectionId: ann.section_id } })}
className="cursor-pointer rounded-lg border ... hover:border-blue-300 hover:shadow-sm transition"
```

Delete button gains `e.stopPropagation()`:

```tsx
onClick={(e) => { e.stopPropagation(); handleDelete(ann.id); }}
```

### `frontend/src/pages/ChaptersPage.tsx`

Imports `useLocation` and reads navigation state:

```ts
const location = useLocation();
const navState = (location.state ?? {}) as { chapterId?: string; sectionId?: string };
```

Initial chapters `useEffect` checks for `navState.chapterId` before falling back to the first sorted chapter:

```ts
if (navState.chapterId) {
  const target = res.data.find((ch) => ch.id === navState.chapterId);
  if (target) {
    setExpandedPart(target.part_number ?? 1);
    handleChapterClick(navState.chapterId, navState.sectionId);
    return;
  }
}
```

`handleChapterClick` gains an optional `targetSectionId` parameter and resolves the section index:

```ts
async function handleChapterClick(chapterId: string, targetSectionId?: string) {
  // ...
  const sectionIndex = targetSectionId
    ? Math.max(0, fullChapter.sections.findIndex((s) => s.id === targetSectionId))
    : 0;
  setCurrentSectionIndex(sectionIndex);
  const sectionRes = await getSectionById(chapterId, fullChapter.sections[sectionIndex].id);
```

`Math.max(0, findIndex(...))` ensures that if the stored `sectionId` is somehow not found (returns `-1`), the chapter still opens at its first section rather than crashing.

### `frontend/src/pages/HistoryPage.tsx`

Imports `getCaseById` from `../api/casesApi`.

Three new state values:

```ts
const [previewQuestion, setPreviewQuestion] = useState<{ stem: string } | null>(null);
const [previewCase, setPreviewCase] = useState<{ title: string; presentation: string } | null>(null);
const [casePreviewLoading, setCasePreviewLoading] = useState(false);
```

`handleCaseRowClick` fetches and stores the case:

```ts
const handleCaseRowClick = (item: CaseHistoryItem) => {
  setCasePreviewLoading(true);
  setPreviewCase(null);
  getCaseById(item.case_id)
    .then((res) => setPreviewCase({ title: res.data.title, presentation: res.data.presentation }))
    .finally(() => setCasePreviewLoading(false));
};
```

Question rows gain `onClick={() => setPreviewQuestion({ stem: item.stem })}` and `cursor-pointer`. Case rows gain `onClick={() => handleCaseRowClick(item)}` and `cursor-pointer`. Both row types add `e.stopPropagation()` to their checkbox `onChange` handlers.

Two modal overlays are appended after the tab content — one for questions, one for cases — using the fixed-overlay / inner-panel pattern described above.

---

## Key Learnings

`progress.txt` contained no recorded entries for this PRD. The following are derived from the implementation itself.

**`useRef` is the right container for session-scoped caches that must not trigger re-renders.** When intermediate state (an answer map, a cache, a debounce timer) is only read imperatively inside event handlers or effects rather than being directly rendered, `useRef` is correct. The rule of thumb: if a value change should update the DOM, use `useState`; if it is only read on demand, use `useRef`.

**Capture the "first attempt" flag before the async call.** If `isFirstAttempt` were evaluated after `await submitAttempt(...)`, a rapid double-click or concurrent submission could produce two simultaneous first-attempt registrations for the same question. Capturing the flag synchronously before the `await` eliminates the race.

**Gating Next on `!attemptResult` is safe only because `attemptResult` is restored from the map on back-navigation.** Had `attemptResult` remained `null` after navigating back to a previously answered question, the Next button would have incorrectly blocked forward progress. The map restoration in the question-change effect is what makes the Next guard correct.

**`location.state` is the appropriate channel for one-shot navigation context.** URL query parameters would pollute the browser history and be bookmarkable (undesirable here — the intent is to land at a section, not persist it). A shared store (Context, Zustand, etc.) would need explicit cleanup. `location.state` is consumed once and discarded automatically when the user navigates away, which is exactly the right lifecycle for this use case.

**`Math.max(0, findIndex(...))` is a cheap defensive pattern for index lookups.** `Array.findIndex` returns `-1` on no match. Wrapping with `Math.max(0, ...)` means a stale or mismatched `sectionId` gracefully degrades to the first section rather than passing a negative index to `getSectionById`.

**The modal close-on-backdrop pattern requires `stopPropagation` on the inner panel.** The outer overlay's `onClick` closes the modal. Without `stopPropagation` on the inner panel, any click anywhere inside the panel would bubble up and close it immediately. Both modals follow the same pattern: overlay closes on click, inner panel calls `e.stopPropagation()`.
