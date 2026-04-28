# PRD: Chapter Reader Tooltip Enhancements — Ask AI Context, Inline Note Input, Highlight

## Introduction

The text-selection tooltip in the chapter reader has three improvements: (1) "Ask AI" should send the selected text with the chapter/section context so the RAG answer is grounded in the right passage; (2) "Add Note" should open an inline textarea inside the tooltip itself (not a separate panel below the content); (3) A third "Highlight" button lets users mark a passage without writing a note.

## Goals

- Ask AI sends selected text with chapter + section title as context so answers stay relevant
- The note input appears directly above/inside the floating tooltip, not as a separate bottom panel
- Users can highlight text (saved as an annotation with empty note) for later review

## User Stories

### US-001: Ask AI — include chapter/section context in the prompt
**Description:** As a resident, I want the AI to answer about the specific passage I selected, grounded in the correct chapter and section, so I don't get generic or unrelated responses.

**Acceptance Criteria:**
- [x] In `frontend/src/pages/ChaptersPage.tsx`, `handleAskAi()` builds a context-aware prompt before calling `openWithText`:
  ```
  const context = sectionContent
    ? `In "${sectionContent.chapter_title} › ${sectionContent.section_title}", the following text appears: `
    : "";
  openWithText(`${context}"${popover.text}"`);
  ```
- [x] If `sectionContent` is null, falls back to just the selected text (no context prefix)
- [x] `AiContext.openWithText` is unchanged — it still prefixes `Regarding: "..." — ` as it does today; the context string is prepended by the call site
- [x] Only `frontend/src/pages/ChaptersPage.tsx` is modified
- [x] Typecheck passes
- [ ] Verify changes work in browser: select text → Ask AI → chat shows the enriched prompt and AI response references the chapter content

### US-002: Add Note — inline textarea inside the tooltip popover
**Description:** As a resident, I want the note input to appear directly in the floating tooltip so I don't have to scroll down to find it.

**Acceptance Criteria:**
- [ ] The `notePanel` state and the bottom-of-page note panel JSX (the amber `mt-4 flex-shrink-0` div) are removed from `ChaptersPage.tsx`
- [ ] The popover instead has two states: `mode: "buttons"` (default — shows Ask AI / Add Note / Highlight) and `mode: "note"` (shows an inline textarea + Save/Cancel)
- [ ] Popover state type becomes: `{ x: number; y: number; text: string; mode: "buttons" | "note" }`
- [ ] Clicking "Add Note" sets `popover.mode = "note"` (keeps x/y/text, just changes mode) and does NOT close the popover
- [ ] In `mode: "note"`, the tooltip renders a `<textarea>` (3 rows, autoFocus) + Save and Cancel buttons; Cancel resets mode to "buttons"; Save calls `createAnnotation` and closes the popover
- [ ] The `noteText` local state and `handleSaveNote` function are updated to work with the new inline flow
- [ ] Typecheck passes
- [ ] Verify changes work in browser: select text → Add Note → textarea appears in tooltip → type note → Save → note appears in sidebar

### US-003: Highlight button — save annotation without note text
**Description:** As a resident, I want to highlight a text passage with one click so I can mark important content without writing a note.

**Acceptance Criteria:**
- [ ] The tooltip `mode: "buttons"` shows three buttons: "Ask AI", "Add Note", "Highlight" (in that order)
- [ ] Clicking "Highlight" calls `createAnnotation({ chapter_id, section_id, selected_text, note_text: "" })` immediately (no text input), closes the popover, and adds the annotation to local state
- [ ] `backend/app/api/v1/routes/annotations.py` `POST /annotations` accepts `note_text` as optional (default `""`): change `note_text: str` to `note_text: str = ""` in the Pydantic request body model
- [ ] In the Notes sidebar and NotesPage, annotations with empty `note_text` are displayed as highlights: show a `🔖` or yellow-background label "Highlighted" instead of the note text
- [ ] Typecheck passes
- [ ] Verify changes work in browser: select text → Highlight → annotation appears in notes sidebar with "Highlighted" label

## Non-Goals

- No DOM mutation to apply yellow background to the section HTML (DOMPurify sanitizes it)
- No highlight color picker
- No edit for highlights (user must delete and re-highlight)

## Technical Considerations

- Backend annotation schema — find the Pydantic model for POST /annotations in `backend/app/api/v1/routes/annotations.py` and make `note_text` optional with default `""`
- The popover div must grow to fit the textarea — remove `whitespace-nowrap` when in `mode: "note"`
- Popover state update for "Add Note": `setPopover(prev => prev ? { ...prev, mode: "note" } : null)`
- `noteText` state can remain at component level; resetting it to `""` on popover close is sufficient
