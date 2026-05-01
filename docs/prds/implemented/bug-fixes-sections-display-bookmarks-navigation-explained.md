# Bug Fixes: Sections Display + Bookmarks Navigation — Implementation Explained

## What Was Implemented and Why

Two unrelated frontend bugs were blocking core user workflows and were fixed together in a single PRD.

**Bug 1 — Chapter sections rendered blank.** The chapter reader fetches annotations as it loads section content. `annotationsApi.ts` was calling three backend routes with wrong URLs: a path parameter instead of a query param, a wrong collection endpoint, and `PUT` instead of `PATCH`. These mismatches caused every annotations request to 404 or behave unexpectedly, which silently broke the chapter reader and prevented the notes feature (built on top of annotations) from functioning at all.

**Bug 2 — BookmarksPage navigation was broken.** Clicking a bookmarked question navigated to `/questions` (the question bank list) rather than `/questions/:id` (the specific question). Additionally, only the small `→` arrow icon was wrapped in a `<Link>` — clicking the card text or whitespace did nothing. Users had to click a 14 px arrow to navigate, and even then landed on the wrong page.

Both fixes are purely frontend. No backend routes, database schema, or data were touched.

## Key Design Decisions

### US-001: Three targeted URL corrections, no structural changes

The three wrong calls in `annotationsApi.ts` were independent mistakes; each was fixed in isolation:

- `getAnnotationsByChapter` — changed from a path segment (`/annotations/chapter/:id`) to a query param (`/annotations?chapter_id=:id`). The backend route uses `Query(chapter_id)`, not a path variable.
- `getAllAnnotations` — changed from `GET /annotations` to `GET /annotations/all`. The base `/annotations` route is only for creating (POST), not listing all annotations across chapters.
- `updateAnnotation` — changed from `PUT` to `PATCH`. The backend handler is registered as `@router.patch`, so PUT was returning 405 Method Not Allowed.

No component files were changed. The bug was entirely in the API layer; fixing only that layer was sufficient and kept the diff minimal.

### US-002: Whole-card `<Link>` wrapper with stop-propagation on the remove button

The previous structure put a `<Link>` only around the `→` arrow inside an otherwise plain `<div>`. Making the whole card clickable required inverting the structure: the `<Link>` becomes the outer element and the content sits inside it.

The remove button (`✕`) inside a `<Link>` creates a nested interactive element problem: clicking the button would both remove the bookmark *and* navigate. The fix is standard — the button's `onClick` calls `e.preventDefault()` and `e.stopPropagation()` before calling `handleRemove()`. `preventDefault` stops the `<Link>` from navigating; `stopPropagation` stops the click from bubbling to the link's own handler.

The button and arrow are placed in a `<div className="relative z-10 ...">` wrapper. The `relative z-10` pairing is a cosmetic guardrail: in case any future overlay or pseudo-element is added to the `<Link>`, the button area stays on top and remains reliably clickable.

The question link destination was corrected from the hardcoded string `"/questions"` to the template literal `` `/questions/${item.item_id}` ``. Case links were already correct (`/cases/${item.item_id}`) and were left unchanged.

## MongoDB Document Shapes Produced

Neither fix involves writes to the database. The annotations and bookmarks collections are read-only from the perspective of these changes. No new document fields, indexes, or collections were introduced.

## How to Run / Verify

Start the frontend dev server:

```bash
cd frontend
npm run dev     # Vite on :5173
```

The backend must be running with annotations data present for US-001 verification:

```bash
cd backend
python -m uvicorn app.main:app --reload   # FastAPI on :8000
```

**Verify US-001 (chapter sections):**
1. Log in and navigate to the Chapters page.
2. Select any chapter — section content should render instead of a blank/loading state.
3. Select a passage of text in a section — the annotation tooltip should appear and saving a note should succeed (no 404 in the network tab).

**Verify US-002 (bookmarks):**
1. Bookmark at least one question and one case.
2. Open the Bookmarks page (`/bookmarks`).
3. Click anywhere on a question bookmark card (text area, whitespace, arrow) — should navigate to `/questions/:id`.
4. Go back, click anywhere on a case bookmark card — should navigate to `/cases/:id`.
5. Click the `✕` remove button on any card — bookmark should be removed without navigating away.

TypeScript check:

```bash
cd frontend
npm run build   # tsc + vite build — must pass with no errors
```

## Files Changed

| File | What changed |
|------|-------------|
| `frontend/src/api/annotationsApi.ts` | Fixed three wrong API call shapes (see below) |
| `frontend/src/pages/BookmarksPage.tsx` | Made whole card a `<Link>`, fixed question route, added stop-propagation on remove button |

### `frontend/src/api/annotationsApi.ts`

Three lines changed, one per broken call:

```ts
// Before → After

api.get<Annotation[]>(`/annotations/chapter/${chapterId}`)
→ api.get<Annotation[]>(`/annotations?chapter_id=${chapterId}`)

api.get<Annotation[]>("/annotations")
→ api.get<Annotation[]>("/annotations/all")

api.put<Annotation>(`/annotations/${id}`, { note_text: noteText })
→ api.patch<Annotation>(`/annotations/${id}`, { note_text: noteText })
```

No other changes. The `Annotation` interface, `CreateAnnotationData` type, `createAnnotation`, and `deleteAnnotation` functions were already correct.

### `frontend/src/pages/BookmarksPage.tsx`

**`BookmarkRow` component — structural inversion**

Before: outer element was a plain `<div>`; a `<Link>` wrapped only the `→` arrow.

After: outer element is the `<Link>` itself (`className="relative block ..."`); the `→` is demoted to a plain `<span>`. The remove button gains an `onClick` that calls `e.preventDefault(); e.stopPropagation()` before delegating to `handleRemove()`.

**`BookmarksPage` — question link destination**

```ts
// Before
const linkTo = activeTab === "question"
  ? "/questions"
  : `/cases/${item.item_id}`;

// After
const linkTo = activeTab === "question"
  ? `/questions/${item.item_id}`
  : `/cases/${item.item_id}`;
```

## Key Learnings

The `progress.txt` for this feature contained no recorded learnings.

**API contract drift is silent at compile time.** TypeScript validates function signatures and return types, but it cannot verify that the URL string passed to `api.get(...)` matches what the backend router actually registered. Wrong path parameters, wrong HTTP methods, and wrong URL shapes all compile cleanly and only fail at runtime — often silently if the calling component swallows errors. The lesson: when wiring up a new API module, verify each endpoint shape directly against the backend router registration, not just against other frontend files.

**Nested interactive elements require explicit stop-propagation.** When a `<button>` sits inside a `<Link>`, clicking the button fires both the button handler and the link navigation. React Router's `<Link>` renders an `<a>` tag, and `<a>` click behavior propagates up the DOM by default. The reliable pattern is `e.preventDefault(); e.stopPropagation()` at the top of the button's `onClick` — `preventDefault` blocks the anchor navigation, `stopPropagation` prevents the event from reaching the link's own listener.
