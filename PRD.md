# PRD: Tooltip — Highlight Button

## Introduction

The inline note textarea is done. This PRD implements only the Highlight button: a one-click way to save a text selection as an annotation without a note.

## Goals

- A third "Highlight" button appears in the tooltip alongside Ask AI and Add Note
- Clicking it saves the selection instantly and shows a 🔖 label in the notes sidebar / Notes page

## User Stories

### US-001: Highlight button — backend + frontend
**Description:** As a resident, I want to highlight a passage with one click so I can mark important text without writing a note.

**Acceptance Criteria:**
- [x] In `backend/app/api/v1/routes/annotations.py`, find the Pydantic request body class for `POST /annotations` and change `note_text: str` to `note_text: str = ""`
- [x] In `frontend/src/api/annotationsApi.ts`, change `CreateAnnotationData.note_text` from `string` to `string | undefined` (or `note_text?: string`)
- [x] In `frontend/src/pages/ChaptersPage.tsx`, add a "Highlight" button as the third button in the `mode === "buttons"` tooltip row
- [x] Clicking "Highlight" (only enabled when `currentChapter` and `sectionContent` are non-null): calls `createAnnotation({ chapter_id: currentChapter.id, section_id: sectionContent.section_id, selected_text: popover.text, note_text: "" })`, on success pushes result to local annotations state and closes the popover
- [x] In the ChaptersPage notes sidebar, entries where `annotation.note_text === ""` display `🔖 Highlight` (amber text) instead of the note body
- [x] In `frontend/src/pages/NotesPage.tsx`, same: entries with empty `note_text` show `🔖 Highlight` label in amber
- [x] Typecheck passes
- [ ] Verify changes work in browser: select text → Highlight → sidebar shows 🔖 entry

## Non-Goals

- No DOM-level yellow highlight in the section HTML

## Technical Considerations

- The backend Pydantic model for the POST body is likely defined inline in `annotations.py` as a `class AnnotationCreate(BaseModel)` — change the `note_text` field default there
- The Highlight button style: `bg-amber-500 hover:bg-amber-600 text-white` to visually distinguish it from the other two buttons
