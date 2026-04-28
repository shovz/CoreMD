# PRD: Bookmarks — BookmarksPage + Case Bookmark + Sidebar Nav

## Introduction

The bookmark backend and the question-session bookmark toggle are already implemented (US-001 and US-002 from the Bookmarks PRD). This PRD covers the missing piece: a BookmarksPage to browse all saved items, a bookmark button on the CaseDetailPage, and the Bookmarks nav link in the sidebar.

## Goals

- Users can bookmark a case from the CaseDetailPage
- A Bookmarks page shows saved questions (tab 1) and saved cases (tab 2)
- The sidebar has a Bookmarks nav link

## User Stories

### US-001: CaseDetailPage bookmark button + BookmarksPage + sidebar nav
**Description:** As a resident, I want to bookmark a case from its detail page and review all my saved questions and cases in one place.

**Acceptance Criteria:**
- [x] `frontend/src/pages/CaseDetailPage.tsx` has a bookmark icon button (★/☆) in the case header area; clicking calls `addBookmark("case", case_id)` or `removeBookmark(case_id)` from `bookmarksApi.ts` and toggles local icon state
- [x] New file `frontend/src/pages/BookmarksPage.tsx` created with two tab buttons: "Questions" and "Cases" (default: Questions tab active)
- [x] Questions tab fetches `GET /bookmarks?type=question`; Cases tab fetches `GET /bookmarks?type=case` — each fetched when its tab is first selected
- [x] Each item row shows: stem/title truncated to 80 chars + "→" link navigating to `/questions` (questions) or `/cases/:case_id` (cases) + ✕ remove button calling `removeBookmark(item_id)`
- [x] Empty state per tab: "No bookmarked questions yet." / "No bookmarked cases yet."
- [x] `frontend/src/router.tsx` has a protected route `/bookmarks` → `BookmarksPage`
- [x] `frontend/src/components/Sidebar.tsx` has a "Bookmarks" nav link added below the History link
- [x] Typecheck passes
- [x] Verify changes work in browser

## Non-Goals

- No bookmark count badge on the sidebar link
- No folder/collection organisation

## Technical Considerations

- `bookmarksApi.ts` already exists at `frontend/src/api/bookmarksApi.ts` — reuse `addBookmark`, `removeBookmark`, `getBookmarks`
- The GET /bookmarks response includes a `document` field with the joined question or case data — use `document.stem` for questions, `document.title` for cases
- `CaseDetailPage.tsx` already imports from `casesApi.ts` — check what `case_id` field is available on the case object
