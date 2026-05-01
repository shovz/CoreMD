---
title: Tooltip — Highlight Button
feature: annotations highlight, ChaptersPage tooltip, NotesPage sidebar
status: fully implemented
---

# Tooltip — Highlight Button

## 1. What Was Implemented and Why

The chapter reader's text-selection tooltip previously had two buttons: "Ask AI" and "Add Note". Both required intent — asking a question or writing a note. There was no way to quickly mark a passage as important without typing anything.

This feature adds a one-click **Highlight** button as a third tooltip action. Clicking it saves the selected text as an annotation with an empty `note_text`, which is then displayed as a `🔖 Highlight` label (amber text) in both the chapter notes sidebar and the global Notes page.

---

## 2. Key Design Decisions

### Empty string as the highlight sentinel

Highlights are stored as regular `annotations` documents with `note_text: ""`. No new collection, no new field, no migration. The frontend checks `ann.note_text === ""` to decide how to render the entry. This keeps the data model uniform: every annotation has a `note_text` field; the empty string signals "highlight, no note".

### Backend schema change: `note_text: str = ""`

Before this feature, `AnnotationCreate.note_text` was a required field (`note_text: str`). The Highlight button cannot send a meaningful note, so the default was added (`note_text: str = ""`). This also makes `note_text` optional in future POST requests — callers that omit it entirely get an empty string automatically.

### Auth dependency corrected: `get_current_user_id` replaces `get_current_user`

All five annotation endpoints (`POST`, `GET /all`, `GET`, `PATCH /{id}`, `DELETE /{id}`) previously depended on `get_current_user`, which resolves the full user document from MongoDB. They only need the `user_id` string. The dependency was changed to `get_current_user_id`, which decodes the JWT and returns the string directly — one fewer DB round-trip per request.

### `onMouseDown={(e) => e.preventDefault()}` on the Highlight button

Like the other tooltip buttons, the Highlight button calls `e.preventDefault()` on `mousedown`. Without it, the browser collapses the active text selection before `onClick` fires, leaving `popover.text` blank and the annotation body empty.

### Popover closes and selection is cleared on success

After `createAnnotation` resolves, `setPopover(null)` closes the tooltip and `window.getSelection()?.removeAllRanges()` clears the browser selection. This mirrors the "Save" path of the inline note form.

### Errors silently swallowed

The `try/catch` around `createAnnotation` in the Highlight handler has an empty catch block. A network error leaves the popover open so the user can retry. No toast or error banner is shown — consistent with the existing "Ask AI" error handling pattern.

---

## 3. MongoDB Document Shapes

Highlights use the same `annotations` collection as text notes.

**Highlight document:**

```json
{
  "_id": ObjectId("..."),
  "user_id": ObjectId("..."),
  "chapter_id": "ch_abc123",
  "section_id": "sec_xyz456",
  "selected_text": "The mitral valve leaflets are normally thin and pliable…",
  "note_text": "",
  "created_at": "2026-04-29T11:00:00Z"
}
```

**Note document (unchanged):**

```json
{
  "_id": ObjectId("..."),
  "user_id": ObjectId("..."),
  "chapter_id": "ch_abc123",
  "section_id": "sec_xyz456",
  "selected_text": "The mitral valve leaflets are normally thin and pliable…",
  "note_text": "Remember: anterior leaflet is larger",
  "created_at": "2026-04-29T11:00:00Z"
}
```

The only difference is `note_text: ""` vs a non-empty string. No schema migration is required.

---

## 4. How to Run the Feature

No scripts — this is a backend schema change + UI addition.

```bash
# Backend
cd backend
python -m uvicorn app.main:app --reload   # :8000

# Frontend
cd frontend
npm run dev                               # :5173
```

**To use the Highlight button:**

1. Open the Chapters page (`/chapters`) and navigate to any section.
2. Select a passage of text with the mouse.
3. The floating dark tooltip appears with three buttons: **Ask AI**, **Add Note**, **Highlight**.
4. Click **Highlight**. The tooltip closes immediately — no extra input required.
5. Click the **Notes** toggle in the reader header to open the sidebar.
6. The new entry appears with the quoted text and a `🔖 Highlight` label in amber.
7. On the `/notes` page, highlight entries also show `🔖 Highlight` instead of a blank note body.

---

## 5. Files Changed

### `backend/app/api/v1/routes/annotations.py`

Two changes:

1. **`AnnotationCreate.note_text`** — default added: `note_text: str = ""`. The field is now optional in POST requests; omitting it or sending `""` is equivalent.
2. **All five route handlers** — dependency changed from `get_current_user` (loads full user document) to `get_current_user_id` (returns JWT `sub` as a string). Functionally equivalent for authorization purposes; avoids one MongoDB lookup per request.

### `frontend/src/api/annotationsApi.ts`

**`CreateAnnotationData.note_text`** changed from `note_text: string` to `note_text?: string`. The field is now optional in TypeScript; callers can omit it entirely. This aligns with the backend default.

### `frontend/src/pages/ChaptersPage.tsx`

Two independent changes:

**1. Highlight button added to `mode === "buttons"` tooltip row:**

```tsx
<button
  onMouseDown={(e) => e.preventDefault()}
  disabled={!currentChapter || !sectionContent}
  onClick={async () => {
    if (!popover || !currentChapter || !sectionContent) return;
    try {
      const res = await createAnnotation({
        chapter_id: currentChapter.id,
        section_id: sectionContent.section_id,
        selected_text: popover.text,
        note_text: "",
      });
      setAnnotations((prev) => [...prev, res.data]);
      setPopover(null);
      window.getSelection()?.removeAllRanges();
    } catch {
      // ignore
    }
  }}
  className="whitespace-nowrap rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-40"
>
  Highlight
</button>
```

**2. Notes sidebar rendering — empty `note_text` branch:**

```tsx
{ann.note_text === "" ? (
  <p className="text-sm font-medium text-amber-600">🔖 Highlight</p>
) : (
  <p className="text-sm text-slate-800">{ann.note_text}</p>
)}
```

Previously the sidebar rendered `{ann.note_text}` unconditionally, which would show blank space for highlights.

### `frontend/src/pages/NotesPage.tsx`

Same empty-`note_text` display change as the ChaptersPage sidebar, applied to the global Notes page cards:

```tsx
{ann.note_text === "" ? (
  <p className="mb-2 text-sm font-medium text-amber-600">🔖 Highlight</p>
) : (
  <p className="mb-2 text-sm text-[var(--ink)]">{ann.note_text}</p>
)}
```

---

## 6. Key Learnings

**`progress.txt` contained no entries for this feature.** The following notes are derived from the diff.

**The empty-string sentinel is simple but requires explicit checks everywhere the field is displayed.** There are currently two display sites (ChaptersPage sidebar, NotesPage cards). If a third display site is added (e.g. a chapter detail view, an export), it must also branch on `note_text === ""` or highlights will render as blank. Consider a shared `renderAnnotationBody(ann)` helper if display sites multiply.

**Auth dependency granularity matters.** `get_current_user` and `get_current_user_id` are both available in `app/core/auth.py`. Routes that only need the user's ID (for a MongoDB filter) should use `get_current_user_id`. Routes that need the full user record (e.g. to read `full_name` or `email`) should use `get_current_user`. The annotations routes only ever use `current_user` as an ObjectId filter — so `get_current_user_id` is correct.

**DOM-level highlight injection is not viable.** `DOMPurify` strips any `<mark>` tags injected into the sanitized section HTML, and the section HTML is re-rendered on every section change. Highlights must live as data and be reflected in UI elements outside the content HTML (sidebar, notes page) — not as mutations to the rendered markup.
