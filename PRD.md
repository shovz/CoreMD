# PRD: Tooltip — Inline Note Input + Highlight Button

## Introduction

US-001 (Ask AI context) is already done. This PRD implements the two remaining tooltip improvements: the note input moving into the floating tooltip itself, and a Highlight button as a third tooltip option.

## Goals

- Clicking "Add Note" expands the tooltip in-place to show a textarea — no separate panel below the content
- A "Highlight" button saves the selection as an annotation with empty note text

## User Stories

### US-001: Inline note textarea in the tooltip popover
**Description:** As a resident, I want the note input to appear in the floating tooltip so I don't have to scroll down.

**Acceptance Criteria:**
- [x] Popover state type in `frontend/src/pages/ChaptersPage.tsx` is extended: `{ x: number; y: number; text: string; mode: "buttons" | "note" }`
- [x] Clicking "Add Note" sets `popover.mode = "note"` using `setPopover(prev => prev ? { ...prev, mode: "note" } : null)` — does NOT close the popover
- [x] When `popover.mode === "note"`, the tooltip div renders: a `<textarea>` (rows=3, autoFocus, bound to `noteText` state) + "Save" and "Cancel" buttons
- [x] "Cancel" resets mode back to `"buttons"` and clears `noteText`
- [x] "Save" (disabled when noteText is empty) calls `createAnnotation({ chapter_id: currentChapter!.id, section_id: sectionContent!.section_id, selected_text: popover.text, note_text: noteText })`, on success adds annotation to local state and closes popover
- [x] The old `notePanel` state, `handleAddNote`, `handleSaveNote`, and the amber bottom-panel JSX block (`{notePanel && ...}`) are removed
- [x] The tooltip container div removes `whitespace-nowrap` when `mode === "note"` so the textarea can wrap
- [x] Typecheck passes
- [ ] Verify changes work in browser: select text → Add Note → textarea appears in floating tooltip

### US-002: Highlight button
**Description:** As a resident, I want to highlight a passage with one click, without writing a note.

**Acceptance Criteria:**
- [ ] `backend/app/api/v1/routes/annotations.py` — in the POST /annotations request body, `note_text` is optional with default `""` (change `note_text: str` → `note_text: str = ""` in the Pydantic model)
- [ ] `frontend/src/api/annotationsApi.ts` — `CreateAnnotationData.note_text` is optional: `note_text?: string`
- [ ] The tooltip `mode: "buttons"` shows three buttons in a row: "Ask AI", "Add Note", "Highlight"
- [ ] Clicking "Highlight": calls `createAnnotation({ chapter_id: currentChapter!.id, section_id: sectionContent!.section_id, selected_text: popover.text, note_text: "" })`, adds result to local annotations state, closes popover
- [ ] In the notes sidebar in ChaptersPage and in `frontend/src/pages/NotesPage.tsx`, annotations with empty `note_text` display a "🔖 Highlight" label styled with `text-amber-600` instead of the note text
- [ ] Typecheck passes
- [ ] Verify changes work in browser: select text → Highlight → annotation appears in sidebar with 🔖 label

## Non-Goals

- No visual highlight on the section HTML (DOMPurify constraint)
- No highlight color picker

## Technical Considerations

- `noteText` useState remains at component level — reuse for the inline textarea
- The popover div style needs `min-w-[240px]` when in note mode so the textarea is usable
- For the Highlight button, `currentChapter` and `sectionContent` must be non-null; the button should be disabled (or hidden) if they are null
