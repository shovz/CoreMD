# UI Fixes: Sections Display, Bookmarks Back Button, Dashboard Alignment — Explained

## 1. What Was Implemented and Why

Three independent frontend bugs were fixed in a single batch:

**US-001 — Chapter sections blocked by failing annotations fetch.**
`handleChapterClick` in `ChaptersPage.tsx` used `Promise.all` to fetch both the chapter content and the annotations simultaneously. If the annotations endpoint failed (network error, backend down, etc.), `Promise.all` rejected and sections never rendered. The fix decouples the two calls so annotations are fire-and-forget.

**US-002 — No way to return to Bookmarks after opening a bookmark.**
Clicking a bookmark navigated to a question or case detail page with no back button pointing to `/bookmarks`. Additionally, each bookmark card showed a redundant `→` arrow icon that was removed. The fix uses React Router's `state` prop to pass `{ from: "bookmarks" }` through navigation, and both detail pages read that state to conditionally render a "← Back to Bookmarks" link.

**US-003 — Continue and Focus Topics cards vertically misaligned on the Dashboard.**
The stats bar (streak / questions / accuracy pills) was inside the same 2-column grid as the Continue and Focus Topics cards. Because it spanned only the left column, it pushed the Continue card down while Focus Topics started at the top of the right column. Moving the stats bar to full-width above the grid gives both cards the same top alignment.

---

## 2. Key Design Decisions

### Annotations as fire-and-forget (US-001)
The annotations call now runs independently using `.then()/.catch()`:

```ts
getAnnotationsByChapter(chapterId)
  .then((r) => setAnnotations(r.data))
  .catch(() => setAnnotations([]));
```

`getChapterById` and the section loading that follows it are completely unaffected by whether annotations succeed or fail. This is appropriate because annotations are an optional overlay on top of chapter content — a failure there should be silent, not destructive.

### React Router `state` for back-navigation context (US-002)
No URL parameters, query strings, or `localStorage` are used. React Router's `<Link state={...}>` passes ephemeral navigation context that lives only as long as the browser history entry. This is the idiomatic approach: lightweight, doesn't pollute the URL, and disappears automatically if the user navigates elsewhere.

The `state` prop is typed as `unknown` in React Router v6, so both detail pages cast it explicitly:
```ts
// QuestionDetailPage — uses a typed interface
const state = (location.state ?? {}) as LocationState;

// CaseDetailPage — inline cast
const fromBookmarks = (location.state as { from?: string } | null)?.from === "bookmarks";
```

### Stats bar lifted out of the grid (US-003)
Before the fix, the DOM structure was roughly:

```
grid (2 cols)
  ├── col 1: stats bar + Continue card
  └── col 2: Focus Topics card
```

After the fix:

```
stats bar (full width, outside grid)
grid (2 cols)
  ├── col 1: Continue card
  └── col 2: Focus Topics card
```

Both cards now start at row 1 of the grid, so they are vertically aligned at every viewport width.

---

## 3. MongoDB Document Shapes

No MongoDB schema changes were made. All three fixes are purely frontend layout and navigation changes.

---

## 4. How to Run

Start the frontend dev server:

```bash
cd frontend
npm run dev   # Vite on http://localhost:5173
```

The backend must also be running if you want real data:

```bash
cd backend
python -m uvicorn app.main:app --reload   # FastAPI on http://localhost:8000
```

Or start everything via Docker:

```bash
cd infra
docker-compose up
```

---

## 5. Files Changed and What Each Change Does

| File | Change |
|---|---|
| `frontend/src/pages/ChaptersPage.tsx` | `handleChapterClick` — `getAnnotationsByChapter` call moved outside `Promise.all` / `await`; now runs independently with `.then().catch()`. Chapter content loads unconditionally. |
| `frontend/src/pages/BookmarksPage.tsx` | `BookmarkRow` component — `state` prop added to `<Link>` (receives `linkState` from parent); `→` arrow span removed. Call site passes `linkState={{ from: "bookmarks" }}`. |
| `frontend/src/pages/QuestionDetailPage.tsx` | `useLocation` used to read `location.state`; if `state.from === "bookmarks"`, renders `← Back to Bookmarks` link instead of `← Back to Questions`. |
| `frontend/src/pages/CaseDetailPage.tsx` | Same pattern as `QuestionDetailPage`: reads `location.state`, conditionally renders `← Back to Bookmarks` vs `← Back to Cases`. |
| `frontend/src/pages/DashboardPage.tsx` | Stats bar (streak/questions/accuracy pills) moved from inside the left grid column to a full-width row above the `grid grid-cols-2` container. The grid now contains only the Continue card and Focus Topics card. |

---

## 6. Key Learnings

**`Promise.all` fails atomically — don't combine unrelated fetches in it.**
Using `Promise.all` for two fetches is only appropriate when both results are required before rendering can proceed. When one fetch is supplementary (like annotations), it should run independently. A single failed annotation request was silently breaking the entire chapter-reading flow.

**React Router `state` is the right tool for transient navigation context.**
Passing `{ from: "bookmarks" }` via `<Link state={...}>` is cleaner than a query parameter because: (1) it doesn't appear in the URL, (2) it doesn't persist across direct-link navigation, (3) it requires no cleanup. The type-casting requirement (`location.state as { from?: string }`) is a small trade-off for this simplicity.

**Grid layout: content that spans the full width should live outside the grid.**
When a full-width element is placed in one column of a 2-column grid it doesn't actually become full-width — it occupies one column and shifts subsequent content in that column down. The pattern is: full-width sections above the grid, grid contains only truly side-by-side content.
