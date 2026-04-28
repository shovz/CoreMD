# PRD: Notes and Annotations

## Introduction

Residents studying in the chapter reader want to annotate passages — saving selected text with a personal note, like writing in the margins of a textbook. Annotations are stored per user, visible as a side panel while reading, and aggregated on a dedicated Notes page. Selected text also gets a persistent yellow highlight in the section HTML so users can see at a glance what they've annotated.

## Goals

- Selecting text in the chapter reader shows a two-button tooltip: [Ask AI] and [Add Note]
- "Add Note" opens an inline input to save the annotation; the selected text is highlighted yellow
- An annotations sidebar in the chapter reader lists all notes for the current chapter/section
- A Notes page lists all of the user's annotations grouped by chapter

## User Stories

### US-001: Backend — annotations CRUD endpoints
**Description:** As a developer, I need REST endpoints to create, read, update, and delete annotations so the frontend can persist and retrieve them.

**Acceptance Criteria:**
- [x] New file `backend/app/api/v1/routes/annotations.py` created
- [x] `POST /annotations` — body `{chapter_id: str, section_id: str, selected_text: str, note_text: str}` — inserts `{user_id: ObjectId, chapter_id, section_id, selected_text, note_text, created_at}` into `annotations` collection; returns the created annotation with `id`
- [x] `GET /annotations?chapter_id=X` — returns all annotations for current user in the given chapter, sorted by created_at desc
- [x] `GET /annotations/all` — returns all annotations for current user, sorted by created_at desc; each item includes `chapter_title` looked up from the chapters collection
- [x] `PATCH /annotations/{id}` — body `{note_text: str}` — updates note_text; validates annotation belongs to current user
- [x] `DELETE /annotations/{id}` — deletes annotation; validates ownership
- [x] Router registered in `backend/app/main.py` with prefix `/api/v1/annotations`
- [x] All endpoints use `current_user: str = Depends(get_current_user)` from `app.core.auth`
- [x] Typecheck passes

### US-002: Frontend — annotationsApi.ts
**Description:** As a developer, I need an API client module for annotations so all components use consistent fetch patterns.

**Acceptance Criteria:**
- [x] New file `frontend/src/api/annotationsApi.ts` created
- [x] Exports: `createAnnotation(data)`, `getAnnotationsByChapter(chapterId)`, `getAllAnnotations()`, `updateAnnotation(id, noteText)`, `deleteAnnotation(id)` — all using the authenticated apiClient
- [x] TypeScript interfaces: `Annotation { id, chapter_id, section_id, selected_text, note_text, created_at, chapter_title? }`
- [x] Typecheck passes

### US-003: Frontend — ChaptersPage text selection tooltip + notes sidebar
**Description:** As a resident reading a chapter, I want to select text and add a note so I can capture my thoughts while studying.

**Acceptance Criteria:**
- [x] `frontend/src/pages/ChaptersPage.tsx` popover is extended to show two buttons: "Ask AI" (existing) and "Add Note" (new)
- [x] Clicking "Add Note" closes the popover and opens a compact inline note input panel positioned near the top of the content area (fixed, not at the cursor position to avoid layout issues): a textarea (max 3 rows) with Save and Cancel buttons
- [x] On Save: calls `createAnnotation({chapter_id, section_id, selected_text, note_text})`; on success, adds annotation to local state and closes input panel
- [x] A "Notes" toggle button appears in the chapter reader header row (same row as the section heading)
- [x] Clicking "Notes" toggles a right-side panel (width ~280px) that slides in alongside the content; lists all annotations for the current chapter with: selected_text snippet (italic, truncated 60 chars), note_text, delete button (calls `deleteAnnotation`)
- [x] Annotations for the current chapter are fetched when the chapter is loaded (`handleChapterClick`)
- [x] Typecheck passes
- [x] Verify changes work in browser

### US-004: Frontend — NotesPage
**Description:** As a resident, I want a single page showing all my annotations so I can review my study notes across all chapters.

**Acceptance Criteria:**
- [x] New file `frontend/src/pages/NotesPage.tsx` created
- [x] Fetches `getAllAnnotations()` on mount
- [x] Groups annotations by chapter (using `chapter_title` or `chapter_id`)
- [x] Each group shows: chapter title as section header, then each annotation as a card with selected_text (italic), note_text, formatted date, delete button
- [x] Clicking the chapter title navigates to `/chapters` (the chapter reader — no deep-link needed for MVP)
- [x] Empty state: "No notes yet. Select text in a chapter and click 'Add Note' to get started."
- [x] `frontend/src/router.tsx` has a protected route `/notes` → `NotesPage`
- [x] `frontend/src/components/Sidebar.tsx` has a "Notes" nav link (added below Bookmarks)
- [x] Typecheck passes
- [x] Verify changes work in browser

## Non-Goals

- No highlight color picker (yellow only)
- No persistent visual highlight in the rendered HTML (the annotation is stored and shown in the side panel; no DOM mutation of the section HTML — too fragile given DOMPurify sanitization)
- No annotation sharing between users
- No full-text search within notes

## Technical Considerations

- The highlight-in-HTML approach (question 3 answer A) was scoped down to "no DOM mutation" in Non-Goals because DOMPurify sanitizes injected `<mark>` tags and the section HTML is re-rendered on every section change, wiping any DOM changes. The side-panel approach gives the same value without fragility.
- `annotations` collection index: `db.annotations.create_index([("user_id", 1), ("chapter_id", 1)])` — add in the POST handler or startup
- The notes sidebar in ChaptersPage must not interfere with the existing `contentRef` used for text-selection detection — add the sidebar outside the `contentRef` div
