---
title: Bookmarks — BookmarksPage + CaseDetailPage Button + Sidebar Nav
feature: BookmarksPage, case bookmark toggle, router route, sidebar nav link
status: fully implemented
---

# Bookmarks — BookmarksPage, Case Bookmark Button, Sidebar Nav

## 1. What Was Implemented and Why

The bookmark backend (POST / DELETE / GET `/bookmarks`) and the question-session toggle were already complete (documented in `bookmarks-favourites-explained.md`). This PRD closed the remaining gap: residents had no way to see all their saved items in one place, and cases could not be bookmarked at all.

Three surfaces were added in a single commit:

- **CaseDetailPage bookmark button** — a ★/☆ icon in the case header that lets residents save a case for later review. Bookmark state is loaded on page open alongside the case data.
- **BookmarksPage** — a new page at `/bookmarks` with two tabs (Questions / Cases). Each tab lists saved items with a truncated title, a navigation link, and a ✕ remove button. Tabs are fetched lazily — the Questions tab loads immediately on mount; the Cases tab loads only when first selected.
- **Sidebar nav link** — a "Bookmarks" entry (with a bookmark ribbon SVG icon) added to the sidebar below History, pointing to `/bookmarks`. The route is protected (requires an authenticated session).

No backend changes were required — all three endpoints were already in place.

---

## 2. Key Design Decisions

### CaseDetailPage: parallel load of case + questions + bookmark state
`CaseDetailPage` wraps three independent fetches in a single `Promise.all`:

```ts
Promise.all([getCaseById(id), getCaseQuestions(id), getBookmarks("case")])
```

The third call fetches the user's full list of case bookmarks and checks whether the current case `id` appears in it. This is cheaper than adding a dedicated `GET /bookmarks/{item_id}` endpoint and avoids a second round-trip after the page renders. For the expected number of bookmarks (dozens, not thousands) the full-list fetch is fast.

### BookmarksPage: lazy tab fetch with null-as-unloaded sentinel
Each tab's state is initialised to `null` (not `[]`). The component treats `null` as "not yet fetched" and `Bookmark[]` (including empty array) as "fetched". This means:

- The Questions tab fetches on first render (before any user interaction).
- The Cases tab fetches only when the user clicks it for the first time.
- Switching back to a previously loaded tab never triggers a second fetch.

The guard lives in `handleTabClick`:

```ts
const alreadyLoaded = tab === "question" ? questionItems !== null : caseItems !== null;
if (!alreadyLoaded) fetchTab(tab);
```

### BookmarkRow: isolated remove-loading state
Each row manages its own `removing: boolean` state rather than having `BookmarksPage` track which item is being deleted. This keeps the list stateless with respect to individual row operations — only the successfully removed item is spliced out of parent state via the `onRemove` callback.

### Local optimistic toggle in CaseDetailPage
The `handleBookmark` function flips `bookmarked` state immediately and calls the API. Errors are swallowed (same pattern as the question-session toggle). There is no rollback on failure — for a convenience feature this is acceptable and keeps the code simple.

### Sidebar: navItems array
Rather than hardcoding JSX, the Sidebar uses a `navItems` array of `{ to, label, icon, end }` objects rendered with `Array.map`. The Bookmarks entry was inserted into this array below History:

```ts
{ to: "/bookmarks", label: "Bookmarks", icon: <BookmarksIcon />, end: false },
```

The SVG for `BookmarksIcon` uses the same outline-bookmark path style as the other sidebar icons — consistent stroke-based icon family.

---

## 3. MongoDB Document Shapes

The `bookmarks` collection is unchanged from the prior implementation. See `bookmarks-favourites-explained.md` for full schema details.

### GET /bookmarks response shape used by BookmarksPage

```json
[
  {
    "type": "question",
    "item_id": "q_042",
    "created_at": "2026-04-27T17:55:00Z",
    "document": {
      "question_id": "q_042",
      "stem": "A 34-year-old woman presents with…",
      "options": ["…", "…", "…", "…"],
      "correct_option": 1,
      "topic": "Cardiology",
      "difficulty": "medium"
    }
  },
  {
    "type": "case",
    "item_id": "case_007",
    "created_at": "2026-04-28T09:12:00Z",
    "document": {
      "case_id": "case_007",
      "title": "Hypertensive Emergency in a 58-year-old",
      "specialty": "Cardiology",
      "presentation": "…"
    }
  }
]
```

`BookmarksPage` reads `document.stem` for questions and `document.title` for cases. Both values are truncated to 80 characters before display. If `document` is `null` (the referenced item was deleted), the row falls back to showing `item_id` as the display text.

---

## 4. How to Use the Feature

### Bookmark a case

1. Navigate to any case: `/cases/:id`.
2. The ☆ icon appears in the top-right of the case header, beside the chapter reference badge.
3. Click ☆ — the icon turns amber (★) and a POST is fired to `/api/v1/bookmarks`.
4. Click ★ again to remove the bookmark (DELETE `/api/v1/bookmarks/{id}`).

### Browse saved items

1. Click **Bookmarks** in the sidebar (or navigate to `/bookmarks` directly).
2. The **Questions** tab loads immediately with all saved questions.
3. Click the **Cases** tab to fetch saved cases on demand.
4. Click **→** on any row to navigate to the item (Questions tab goes to `/questions`; Cases tab goes to `/cases/:id`).
5. Click **✕** on any row to remove that bookmark immediately.

### API (curl / Swagger)

```bash
# List case bookmarks
GET /api/v1/bookmarks?type=case
Authorization: Bearer <jwt_token>

# Bookmark a case
POST /api/v1/bookmarks
Authorization: Bearer <jwt_token>
Content-Type: application/json
{"type": "case", "item_id": "case_007"}

# Remove a bookmark
DELETE /api/v1/bookmarks/case_007
Authorization: Bearer <jwt_token>
```

Swagger UI: `http://localhost:8000/docs` → **bookmarks** tag.

---

## 5. Files Changed

### `frontend/src/pages/BookmarksPage.tsx` _(new file)_
New page component. Key structure:

- **`BookmarkRow`** sub-component: renders one saved item with display text, a `Link` to the item, and a ✕ remove button. Owns its own `removing` boolean state.
- **`BookmarksPage`**: manages `questionItems: Bookmark[] | null` and `caseItems: Bookmark[] | null`. Questions tab auto-fetches on mount (via the `if (questionItems === null && !loading && !error)` guard at the top of the render function). Cases tab fetches lazily via `handleTabClick`. `handleRemove` filters the removed item out of whichever tab's state array is currently active.

Display text resolution:

```ts
const displayText = activeTab === "question"
  ? (doc?.stem ?? item.item_id)
  : (doc?.title ?? item.item_id);
```

### `frontend/src/pages/CaseDetailPage.tsx` _(modified)_
Three additions:

1. Import of `addBookmark`, `removeBookmark`, `getBookmarks` from `bookmarksApi.ts`.
2. State: `bookmarked: boolean` and `bookmarkLoading: boolean`.
3. The `Promise.all` in the load `useEffect` extended to include `getBookmarks("case")`, with the result used to seed `bookmarked`:
   ```ts
   setBookmarked(bmRes.data.some((b) => b.item_id === id));
   ```
4. `handleBookmark` async toggle function.
5. ★/☆ button rendered in the case header `flex` row alongside the chapter reference badge.

### `frontend/src/router.tsx` _(modified)_
Added `BookmarksPage` import and a protected route:

```tsx
import BookmarksPage from "./pages/BookmarksPage";
// …
<Route path="/bookmarks" element={<BookmarksPage />} />
```

The route lives inside the existing `<ProtectedRoute />` wrapper — unauthenticated users are redirected to `/login`.

### `frontend/src/components/Sidebar.tsx` _(modified)_
Two additions:

1. `BookmarksIcon` function component — an SVG ribbon icon matching the sidebar's existing icon style (`h-4 w-4`, `stroke="currentColor"`, `strokeWidth={2}`).
2. An entry appended to the `navItems` array: `{ to: "/bookmarks", label: "Bookmarks", icon: <BookmarksIcon />, end: false }`.

No other sidebar logic changed — the new item is rendered automatically by the existing `navItems.map` loop.

---

## 6. Key Learnings

**Progress log was empty for this feature.** No surprises were encountered; the backend was already complete and the frontend patterns followed directly from the existing question-session bookmark implementation.

**`null` as "not yet loaded" is cleaner than a separate boolean flag.** Using `Bookmark[] | null` avoids a `loaded: boolean` alongside every `data` state variable. The `null` sentinel unambiguously means "not fetched yet", while `[]` means "fetched, but empty". This distinction drives both the lazy-fetch guard and the empty-state message.

**`Promise.all` for parallel page initialisation.** Wrapping three independent fetches in `Promise.all` on `CaseDetailPage` means the page renders in the time of the slowest request (one round-trip) rather than three sequential round-trips. This is especially worthwhile because `getBookmarks("case")` returns the full list — keeping it off the critical path of the case data would have required an extra render cycle.

**A bookmark list is owned by the page that displays it, not shared state.** `BookmarksPage` does not use a global store or context. Removed items are filtered out of local state immediately, and there is no cache to invalidate. For a low-volume collection this is correct: simplicity over consistency, since the only thing that changes bookmarks is the user's own action in this tab.
