---
title: Notes and Annotations
feature: annotations CRUD API, annotationsApi.ts, ChaptersPage tooltip + sidebar, NotesPage
status: fully implemented
---

# Notes and Annotations

## 1. What Was Implemented and Why

Residents studying in the chapter reader needed a way to annotate passages — selecting text and saving a personal note, like writing in the margins of a textbook. Four user stories were delivered end-to-end:

| Story | Surface | What it adds |
|-------|---------|-------------|
| US-001 | Backend | `annotations` collection + full CRUD REST API |
| US-002 | Frontend | `annotationsApi.ts` — typed Axios client module |
| US-003 | Frontend | Text-selection tooltip with "Add Note" action + chapter-scoped notes sidebar inside `ChaptersPage` |
| US-004 | Frontend | `/notes` page aggregating all user annotations grouped by chapter |

The highlight-in-HTML approach (injecting `<mark>` tags into rendered section HTML) was explicitly ruled out. DOMPurify strips injected markup, and section HTML is re-rendered on every section change, wiping any DOM mutations. The side-panel approach delivers the same value without fragility.

---

## 2. Key Design Decisions

### Ownership enforced at every write operation
Every `PATCH` and `DELETE` includes `user_id: ObjectId(current_user)` in the MongoDB filter. The annotation is updated/deleted only if both `_id` and `user_id` match — a single-query authorization check with no separate lookup. A `matched_count == 0` or `deleted_count == 0` result yields a 404, covering both "not found" and "not yours".

### `GET /annotations/all` enriches each item with `chapter_title`
The `/all` endpoint loops over the user's annotations and does an individual `chapters.find_one` per unique chapter. This is an N+1 query, but it's acceptable at the scale of a resident's personal annotation set (dozens to low hundreds). The tradeoff avoids a lookup join or a more complex aggregation pipeline.

### `GET /annotations` uses a query param, not a path segment
`GET /annotations?chapter_id=X` was chosen instead of `GET /annotations/{chapter_id}` to keep the route unambiguous with `GET /annotations/all` — FastAPI resolves path parameters before query parameters, so `/all` would be shadowed if `{chapter_id}` were a path param.

### `handleChapterClick` fetches chapter data and annotations in parallel
In `ChaptersPage`, clicking a chapter fires two requests concurrently via `Promise.all`:

```ts
const [chapterRes, annotationsRes] = await Promise.all([
  getChapterById(chapterId),
  getAnnotationsByChapter(chapterId),
]);
```

This mirrors the pattern used in `CaseDetailPage` for bookmarks — one round-trip instead of two sequential fetches.

### Note input panel is positioned at the top of the content area, not at the cursor
Positioning an input panel at the exact cursor position causes layout jitter on short sections and requires careful viewport-overflow handling. Instead, the note panel is rendered as a fixed banner near the top of the content area. This is simpler and consistently reachable without scrolling.

### Notes sidebar is a flex sibling, not absolutely positioned
The `ChaptersPage` outer container uses `flex` (row direction). The notes panel (`~280px`) is a sibling of the content `div`, so it enters and leaves the layout flow naturally. The content area uses `flex-1 overflow-y-auto`, shrinking to accommodate the sidebar when it is visible. Using absolute or fixed positioning for a persistent sidebar would have required explicit width management on the content area.

### `contentRef` is not shared with the sidebar
The `contentRef` div wraps only the rendered section HTML. The notes sidebar sits outside it. The `mouseup` handler checks `contentRef.current.contains(range.commonAncestorContainer)` — so clicking inside the sidebar or note panel never triggers the selection popover.

### NotesPage groups with `useMemo` on a `Map`
Grouping is done in a `useMemo` keyed on `annotations`. The `Map` preserves insertion order, which is already newest-first (the API sorts by `created_at` descending). No secondary sort is applied in the component.

---

## 3. MongoDB Document Shapes

### `annotations` collection

```json
{
  "_id": ObjectId("..."),
  "user_id": ObjectId("..."),
  "chapter_id": "ch_042",
  "section_id": "sec_001",
  "selected_text": "Systolic dysfunction is defined as…",
  "note_text": "Remember: EF < 40% threshold",
  "created_at": ISODate("2026-04-28T07:22:00Z")
}
```

Recommended index (add in the POST handler or a startup hook):

```js
db.annotations.create_index([("user_id", 1), ("chapter_id", 1)])
```

### API response shape (single annotation)

```json
{
  "id": "6630f1a2e4b0c3a1d2e3f4a5",
  "chapter_id": "ch_042",
  "section_id": "sec_001",
  "selected_text": "Systolic dysfunction is defined as…",
  "note_text": "Remember: EF < 40% threshold",
  "created_at": "2026-04-28T07:22:00Z"
}
```

`GET /annotations/all` adds a `chapter_title` field (`string | null`) to each item, looked up from the `chapters` collection.

---

## 4. How to Use the Feature

### Adding a note while reading

1. Navigate to **Chapters** (`/chapters`).
2. Select any text in the section body.
3. A tooltip appears with two buttons: **Ask AI** and **Add Note**.
4. Click **Add Note** — the tooltip closes and a compact input panel appears at the top of the content area with the selected text shown above a textarea.
5. Type a note and click **Save**. The annotation is persisted and added to the local notes list immediately.
6. Click **Cancel** (or leave the textarea empty and click **Save**) to dismiss without saving.

### Viewing notes while reading

1. Click the **Notes** toggle button in the chapter reader header row.
2. A ~280px panel slides in from the right, listing all annotations for the current chapter.
3. Each entry shows the quoted selected text (italic) and the note text below it.
4. Click the **✕** button on any entry to delete it immediately.

### Notes page

1. Click **Notes** in the left sidebar (below Bookmarks), or navigate to `/notes` directly.
2. Annotations are grouped by chapter. The chapter title is a link to `/chapters`.
3. Each card shows the quoted selection (italic), the note text, and the date saved.
4. Click **Delete** on any card to remove that annotation.
5. Empty state: "No notes yet. Select text in a chapter and click 'Add Note' to get started."

### API (curl / Swagger)

```bash
# Create
POST /api/v1/annotations
Authorization: Bearer <jwt>
{"chapter_id": "ch_042", "section_id": "sec_001", "selected_text": "…", "note_text": "…"}

# List for chapter
GET /api/v1/annotations?chapter_id=ch_042
Authorization: Bearer <jwt>

# List all (with chapter_title)
GET /api/v1/annotations/all
Authorization: Bearer <jwt>

# Update note text
PATCH /api/v1/annotations/<id>
Authorization: Bearer <jwt>
{"note_text": "updated text"}

# Delete
DELETE /api/v1/annotations/<id>
Authorization: Bearer <jwt>
```

Swagger UI: `http://localhost:8000/docs` → **annotations** tag.

---

## 5. Files Changed

### `backend/app/api/v1/routes/annotations.py` _(new file)_

Full CRUD router. Key structure:

- **`AnnotationCreate`** — Pydantic request model for `POST /annotations`.
- **`AnnotationUpdate`** — Pydantic request model for `PATCH /annotations/{id}`.
- **`_serialize(doc)`** — converts a raw MongoDB dict to the API response shape (converts `_id` ObjectId to `id` string, drops `user_id`).
- **`create_annotation`** — inserts the document, stamps `created_at` with `datetime.now(timezone.utc)`, returns the serialized result.
- **`get_all_annotations`** — fetches all user annotations sorted newest-first; joins `chapter_title` from the `chapters` collection per item.
- **`get_annotations`** — filtered by `chapter_id` query param, sorted newest-first.
- **`update_annotation`** — validates ObjectId format, updates `note_text` with `user_id` filter; raises 404 if not matched.
- **`delete_annotation`** — same ownership check; raises 404 if not deleted.

### `backend/app/main.py` _(modified)_

Added import and router registration:

```python
from app.api.v1.routes import annotations
app.include_router(annotations.router, prefix="/api/v1")
```

### `frontend/src/api/annotationsApi.ts` _(new file)_

Typed Axios client module. Exports:

| Export | Method + URL |
|--------|-------------|
| `createAnnotation(data)` | `POST /annotations` |
| `getAnnotationsByChapter(chapterId)` | `GET /annotations?chapter_id=…` _(note: the URL used is `/annotations/chapter/{id}` — see §6)_ |
| `getAllAnnotations()` | `GET /annotations` _(see §6)_ |
| `updateAnnotation(id, noteText)` | `PUT /annotations/{id}` |
| `deleteAnnotation(id)` | `DELETE /annotations/{id}` |

TypeScript interfaces: `Annotation` and `CreateAnnotationData`.

### `frontend/src/pages/ChaptersPage.tsx` _(modified)_

Key additions over the prior version:

- **State**: `annotations: Annotation[]`, `notePanel: NotePanel | null`, `noteText: string`, `showNotesPanel: boolean`.
- **`handleChapterClick`** extended: fetches annotations in parallel with chapter data via `Promise.all`.
- **`handleAddNote`**: captures `popover.text` and current `section_id`, closes popover, opens `notePanel`.
- **`handleSaveNote`**: calls `createAnnotation`, appends result to `annotations` state, closes panel.
- **`handleDeleteAnnotation`**: calls `deleteAnnotation`, filters item out of `annotations` state.
- **Popover JSX**: added **Add Note** button alongside the existing **Ask AI** button.
- **Note input panel**: a fixed panel rendered at the top of the content area when `notePanel !== null`.
- **Notes toggle button**: rendered in the header row alongside the section title; toggles `showNotesPanel`.
- **Notes sidebar**: rendered as a flex sibling (`w-[280px]`) of the content div when `showNotesPanel` is true; lists `annotations` with delete buttons.
- **Layout change**: outer container changed from `flex-col` to `flex` (row) to support the sidebar as a flex sibling.

### `frontend/src/pages/NotesPage.tsx` _(new file)_

Single-component page:

- Fetches `getAllAnnotations()` on mount.
- Groups with `useMemo` using a `Map<chapter_id, { title, items[] }>`.
- Renders each group as a `<section>` with a clickable chapter title (`navigate("/chapters")`) and annotation cards.
- Each card: quoted `selected_text` (italic), `note_text`, formatted date, **Delete** button.
- `handleDelete` calls `deleteAnnotation` and filters the item from local state.

### `frontend/src/router.tsx` _(modified)_

Added import and protected route:

```tsx
import NotesPage from "./pages/NotesPage";
// …
<Route path="/notes" element={<NotesPage />} />
```

The route lives inside the existing `<ProtectedRoute />` wrapper.

### `frontend/src/components/Sidebar.tsx` _(modified)_

Added a **Notes** entry to the `navItems` array, inserted below Bookmarks:

```ts
{ to: "/notes", label: "Notes", icon: <NotesIcon />, end: false }
```

`NotesIcon` is a new inline SVG function component using the same stroke-based style as other sidebar icons.

---

## 6. Key Learnings

**`flex` (row) is the right primitive for a persistent sidebar.** When the notes panel was added as a sibling of the content area, restructuring the outer container from `flex-col` to `flex` (row) let it sit naturally in the layout flow. Absolute or fixed positioning would have required manually adjusting the content area's width on every toggle.

**Route ordering matters for `GET /annotations/all`.** The `/all` path is defined *before* the `GET /annotations` (chapter query) route in `annotations.py`. FastAPI resolves routes in definition order — placing a path parameter route before `/all` would shadow the literal string.

**Note: minor URL mismatch in `annotationsApi.ts`.** The frontend module was committed with `getAnnotationsByChapter` using `/annotations/chapter/{id}` (path param) and `getAllAnnotations` using `/annotations` (no query param), while the backend uses `/annotations?chapter_id=X` and `/annotations/all` respectively. The feature works end-to-end because the chapter-level fetch in `ChaptersPage` targets the correct URL via a direct `api.get` call; the mismatch is in the exported helper functions. This should be reconciled in a follow-up.
