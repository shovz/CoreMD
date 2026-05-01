# Chapter Reader Tooltip Enhancements — Ask AI Context, Inline Note Input, Highlight

## 1. What Was Implemented and Why

The chapter reader's text-selection tooltip had three planned improvements:

| Story | Goal | Status |
|-------|------|--------|
| US-001 | Ask AI sends selected text with chapter + section context | **Done** |
| US-002 | "Add Note" opens inline textarea inside the tooltip, not a bottom panel | Pending |
| US-003 | "Highlight" button saves an annotation without requiring a note | Pending |

**US-001 is the only story merged so far.** The rationale: without chapter/section context the AI received bare quoted text and produced generic responses. Prepending the chapter and section title gives the RAG pipeline enough signal to retrieve the right passages from Harrison's.

---

## 2. Key Design Decisions

### US-001 — Where to inject context

Context is built at the **call site** (`handleAskAi` in `ChaptersPage.tsx`) rather than inside `AiContext.openWithText`. This keeps the AI context layer generic — it doesn't need to know anything about chapters or sections — and makes it easy for other pages to call `openWithText` with their own context prefix.

`AiContext.openWithText` always wraps whatever it receives in `Regarding: "..." — `, so the final prompt the AI sees is:

```
Regarding: "In "Chapter Title › Section Title", the following text appears: "selected text"" —
```

If `sectionContent` is null (no section loaded), the context prefix is omitted and only the quoted text is sent — a safe fallback.

### US-002 — Inline tooltip vs. bottom panel (planned)

The PRD calls for replacing the existing `notePanel` state and the amber `mt-4` div below the content with a two-mode popover (`"buttons"` | `"note"`). The motivation is UX: the note form currently appears far below the selected text, requiring the user to scroll. Inline placement keeps the interaction co-located with the selection. This work has not been started yet.

### US-003 — Highlight as annotation with empty note (planned)

Rather than a separate collection or a DOM mutation (which DOMPurify would sanitize away), highlights are stored as ordinary annotations with `note_text: ""`. The backend `note_text` field needs to become optional (`= ""`), and the Notes sidebar needs to render an empty `note_text` as a "Highlighted" label instead of blank space. This work has not been started yet.

---

## 3. MongoDB Document Shapes

### `annotations` collection

Each annotation — whether a note or a future highlight — is stored as:

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

When US-003 is implemented, highlights will use the same shape with `note_text: ""`.

---

## 4. How to Run the Feature

No scripts to run — this is a UI/API change.

```bash
# Backend
cd backend
python -m uvicorn app.main:app --reload   # :8000

# Frontend
cd frontend
npm run dev                               # :5173
```

To exercise US-001:
1. Open a chapter, navigate to any section.
2. Select a passage of text with the mouse.
3. Click **Ask AI** in the floating tooltip.
4. The AI chat panel opens; the pre-filled message reads:
   `Regarding: "In "<Chapter> › <Section>", the following text appears: "<selection>"" —`

---

## 5. Files Changed

### `frontend/src/pages/ChaptersPage.tsx` (US-001)

**`handleAskAi()`** — previously passed the raw selected text directly to `openWithText`. Now builds a context prefix:

```ts
const context = sectionContent
  ? `In "${sectionContent.chapter_title} › ${sectionContent.section_title}", the following text appears: `
  : "";
openWithText(`${context}"${text}"`);
```

`sectionContent` holds the currently loaded section response (chapter title, section title, HTML content). It is null only if no section has been loaded yet, in which case the fallback sends just the quoted text.

No other files were changed for the implemented story.

---

### Files Planned but Not Yet Changed

| File | Planned change (US) |
|------|---------------------|
| `frontend/src/pages/ChaptersPage.tsx` | Add `mode: "buttons" \| "note"` to popover state; render inline textarea when `mode === "note"`; remove `notePanel` state and bottom amber panel (US-002) |
| `frontend/src/pages/ChaptersPage.tsx` | Add "Highlight" button to popover; call `createAnnotation` with `note_text: ""` immediately (US-003) |
| `frontend/src/pages/ChaptersPage.tsx` | Render annotations with empty `note_text` as a "Highlighted" label in the Notes sidebar (US-003) |
| `backend/app/api/v1/routes/annotations.py` | Change `note_text: str` to `note_text: str = ""` in `AnnotationCreate` so the field is optional (US-003) |

---

## 6. Key Learnings

No implementation learnings were recorded in `progress.txt` for this feature.

**Architectural notes worth knowing:**

- **`AiContext` is intentionally context-agnostic.** `openWithText(text)` simply prefixes `Regarding: "..." — ` and opens the panel. Any page-specific context (chapter, section, case, question) must be assembled by the caller before invoking `openWithText`. This is the established pattern.
- **Popover positioning uses `getBoundingClientRect` + `position: fixed`.** The tooltip is placed at `(rect.left + rect.width / 2, rect.top)` and shifted up with `transform: translate(-50%, calc(-100% - 8px))`. When US-002 adds a textarea to the popover, `whitespace-nowrap` must be removed so the popover can grow to fit.
- **`onMouseDown={(e) => e.preventDefault()}`** on tooltip buttons prevents the selection from being cleared before the click handler fires — required because clicking normally removes the active selection.
- **DOMPurify blocks DOM mutations**, so highlights cannot be implemented by injecting `<mark>` tags into the sanitized HTML. The annotation-with-empty-note approach is the correct workaround.
