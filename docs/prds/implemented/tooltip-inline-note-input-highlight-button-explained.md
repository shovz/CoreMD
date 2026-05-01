# Tooltip — Inline Note Input + Highlight Button

## 1. What Was Implemented and Why

The chapter reader's text-selection tooltip previously showed two buttons ("Ask AI" and "Add Note"). Clicking "Add Note" opened a separate amber panel anchored below the section content, far from where the user was reading. The resident had to scroll down to see the note form, then scroll back up after saving.

This PRD replaces that bottom panel with an inline textarea that expands inside the floating tooltip itself. The selection stays visible, the note form is right there, and the UX is co-located with the action.

| Story | Goal | Status |
|-------|------|--------|
| US-001 | Inline note textarea inside the floating tooltip popover | **Done** |
| US-002 | "Highlight" button — save annotation with no note required | **Not started** |

---

## 2. Key Design Decisions

### Two-mode popover state

The popover state type was extended from `{ x, y, text }` to `{ x, y, text, mode: "buttons" | "note" }`. This means the same tooltip div renders two completely different UIs without any extra mounting/unmounting — it just re-renders based on `mode`.

Clicking "Add Note" calls:
```ts
setPopover(prev => prev ? { ...prev, mode: "note" } : null)
```
This preserves `x`, `y`, and `text` (the selection coordinates and content) while switching to the textarea view. The popover does not close and re-open — it transitions in-place, keeping its position anchored to the selected text.

### `w-64` fixed width in note mode

When `mode === "buttons"`, both buttons are on one row with `whitespace-nowrap` and the popover auto-sizes. In `mode === "note"`, the popover switches to a `w-64` (256 px) container so the textarea has a sensible width. A too-narrow textarea would be unusable for typing.

### `autoFocus` on the textarea

The textarea gets `autoFocus` so the keyboard cursor lands in it immediately when the user clicks "Add Note". No extra click needed.

### `onMouseDown={(e) => e.preventDefault()}` on all buttons

Clicking a button normally collapses the browser's active text selection before the `onClick` handler fires. `e.preventDefault()` on `mousedown` prevents the selection from being lost. This is required on every tooltip button — not just Save/Cancel.

### Old `notePanel` / `handleAddNote` removed

The previous implementation tracked a separate `notePanel: { text: string } | null` state and rendered an amber `mt-4` div in the main content column. Both are gone. The same `noteText` useState and `handleSaveNote` function are now used by the inline textarea, so no new state was needed.

### US-002 deferred — why `note_text` stays required for now

The Highlight button will save an annotation with `note_text: ""`. To make that work cleanly, the backend `AnnotationCreate` model must change `note_text: str` → `note_text: str = ""` so the field is optional in POST requests. That change has not been made yet. Until US-002 is implemented, `note_text` remains required on both the backend Pydantic model and the frontend `CreateAnnotationData` interface.

---

## 3. MongoDB Document Shapes

All annotations — notes and future highlights — use the same collection and shape.

**`annotations` collection:**

```json
{
  "_id": ObjectId("..."),
  "user_id": ObjectId("..."),
  "chapter_id": "ch_abc123",
  "section_id": "sec_xyz456",
  "selected_text": "The mitral valve leaflets...",
  "note_text": "Remember: anterior leaflet is larger",
  "created_at": "2026-04-29T10:00:00Z"
}
```

When US-002 is implemented, highlights will use the same shape with `note_text: ""`. The Notes sidebar will need to check for empty `note_text` and render a "🔖 Highlight" label instead of blank space.

---

## 4. How to Run the Feature

No scripts — this is a pure UI change.

```bash
# Backend
cd backend
python -m uvicorn app.main:app --reload   # :8000

# Frontend
cd frontend
npm run dev                               # :5173
```

**To exercise the inline note feature:**
1. Open the Chapters page and navigate to any section.
2. Select a passage of text with the mouse.
3. The floating dark tooltip appears above the selection.
4. Click **Add Note** — the tooltip expands into a textarea (autoFocused, 3 rows).
5. Type a note and click **Save** (disabled until text is non-empty). The annotation is posted to `POST /api/v1/annotations` and appended to the Notes sidebar immediately.
6. Click **Cancel** to return to the two-button view without saving.
7. The **Notes** button in the top-right of the reader shows the annotation count; click it to open the sidebar.

---

## 5. Files Changed

### `frontend/src/pages/ChaptersPage.tsx`

**`Popover` interface** — `mode: "buttons" | "note"` added:
```ts
interface Popover {
  x: number;
  y: number;
  text: string;
  mode: "buttons" | "note";
}
```

**`handleMouseUp`** — now initialises popover with `mode: "buttons"`:
```ts
setPopover({ x: rect.left + rect.width / 2, y: rect.top, text, mode: "buttons" });
```

**`handleSaveNote`** (previously `handleSaveNote` called from the bottom panel) — unchanged in logic; now called from the inline Save button inside the tooltip.

**Popover JSX** — the tooltip div now conditionally renders two branches:
- `mode === "buttons"`: the existing "Ask AI" + "Add Note" button row (unchanged appearance).
- `mode === "note"`: a `w-64` dark container with a `<textarea>` (autoFocus, rows=3, bound to `noteText`) and Save / Cancel buttons.

**Removed:**
- `notePanel` state (`const [notePanel, setNotePanel] = useState<...>(null)`)
- `handleAddNote` function (previously set `notePanel`)
- The amber bottom-panel JSX block (`{notePanel && <div className="mt-4 ...">...</div>}`)

No other files were changed for US-001.

---

### Files Planned but Not Yet Changed (US-002)

| File | Planned change |
|------|----------------|
| `backend/app/api/v1/routes/annotations.py` | `note_text: str` → `note_text: str = ""` in `AnnotationCreate` |
| `frontend/src/api/annotationsApi.ts` | `note_text: string` → `note_text?: string` in `CreateAnnotationData` |
| `frontend/src/pages/ChaptersPage.tsx` | Add "Highlight" button to `mode === "buttons"` row; on click, call `createAnnotation` with `note_text: ""` and close popover |
| `frontend/src/pages/ChaptersPage.tsx` | In the Notes sidebar, render `ann.note_text === "" ? <span className="text-amber-600">🔖 Highlight</span> : ann.note_text` |
| `frontend/src/pages/NotesPage.tsx` | Same empty-`note_text` display change in the global Notes page |

---

## 6. Key Learnings

No entries were recorded in `progress.txt` for this feature.

**Architectural notes worth knowing:**

- **Mode-switching inside a single div is simpler than mounting/unmounting.** A two-branch conditional on `mode` avoids positioning edge cases that would arise if the popover closed and reopened at a slightly different location.
- **`setPopover(prev => prev ? { ...prev, mode: "note" } : null)` is the safe way to transition.** Using a functional updater ensures the previous `x`, `y`, and `text` values are preserved even if React batches the state update with something else.
- **The Highlight button (US-002) is blocked on a backend schema change.** The frontend cannot safely send `note_text: ""` while the backend Pydantic model treats it as required — the field would still be accepted (empty string is valid for `str`), but the intent is ambiguous until the default is explicit. Make the backend change first, then wire up the button.
- **DOMPurify prevents DOM-level highlight injection.** `<mark>` tags injected into the sanitized HTML are stripped. Highlights must be stored as data (annotations with `note_text: ""`) and rendered as UI overlays or sidebar labels — not as mutations to the section HTML.
