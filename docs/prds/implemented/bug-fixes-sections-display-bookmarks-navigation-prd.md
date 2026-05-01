# PRD: Bug Fixes — Sections Display + Bookmarks Navigation

## Introduction

Two bugs block core functionality: (1) `annotationsApi.ts` uses wrong URLs causing the chapter reader to fail silently and render blank sections; (2) BookmarksPage navigates question cards to the settings screen instead of the actual question, and only the small arrow is clickable instead of the whole card.

## Goals

- Chapter sections render correctly when a chapter is selected
- Notes feature is unblocked (depends on fix 1)
- Clicking anywhere on a bookmarked question card opens that question
- Clicking anywhere on a bookmarked case card opens that case

## User Stories

### US-001: Fix annotationsApi.ts URL mismatches
**Description:** As a developer, I need `annotationsApi.ts` to call the correct backend URLs so that the chapter reader works and the notes feature is usable.

**Acceptance Criteria:**
- [x] `frontend/src/api/annotationsApi.ts` `getAnnotationsByChapter(chapterId)` calls `GET /annotations?chapter_id=${chapterId}` (query param, not path param)
- [x] `frontend/src/api/annotationsApi.ts` `getAllAnnotations()` calls `GET /annotations/all` (not `GET /annotations`)
- [x] `frontend/src/api/annotationsApi.ts` `updateAnnotation(id, noteText)` uses `PATCH` method (not `PUT`)
- [x] Only `frontend/src/api/annotationsApi.ts` is modified — no backend changes
- [x] Typecheck passes
- [x] Verify changes work in browser: select a chapter → section content renders correctly

### US-002: Fix BookmarksPage — whole card clickable + question route
**Description:** As a resident, I want to click anywhere on a bookmark card to open the item, and bookmarked questions should open the actual question page.

**Acceptance Criteria:**
- [x] In `frontend/src/pages/BookmarksPage.tsx`, each bookmark row is wrapped in a `<Link>` that covers the entire card (not just the arrow icon)
- [x] Bookmarked questions navigate to `/questions/${item.item_id}` (the QuestionDetailPage), not `/questions`
- [x] Bookmarked cases continue to navigate to `/cases/${item.item_id}`
- [x] The ✕ remove button still works without triggering navigation (use `e.preventDefault()` + `e.stopPropagation()` on the remove button click)
- [x] Typecheck passes
- [x] Verify changes work in browser: click a question bookmark card → opens the question; click a case bookmark card → opens the case

## Non-Goals

- No changes to bookmark backend
- No changes to how bookmarks are added/removed

## Technical Considerations

- `annotationsApi.ts` is at `frontend/src/api/annotationsApi.ts`
- `BookmarksPage.tsx` is at `frontend/src/pages/BookmarksPage.tsx`
- The `<Link>` wrapper approach: wrap the entire row div in `<Link to={linkTo} className="block">` and give it `relative` positioning; put the remove button inside with `relative z-10` and an `onClick` that calls `e.preventDefault(); e.stopPropagation(); handleRemove(...)`
