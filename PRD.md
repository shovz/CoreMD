# PRD: Bookmarks / Favourites

## Introduction

Residents encounter questions and clinical cases they want to revisit but have no way to save them. A bookmark system lets them star any question or case, then review all saved items from a dedicated Bookmarks page.

## Goals

- Users can bookmark and un-bookmark individual questions (from the question session view) and cases (from the case detail page)
- A Bookmarks page shows all saved questions and cases in separate tabs
- Bookmarks persist across sessions (stored in MongoDB)

## User Stories

### US-001: Backend — bookmarks CRUD endpoints
**Description:** As a developer, I need REST endpoints to add, remove, and list bookmarks so the frontend can persist them.

**Acceptance Criteria:**
- [x] New file `backend/app/api/v1/routes/bookmarks.py` created
- [x] `POST /bookmarks` — body `{type: "question"|"case", item_id: str}` — inserts `{user_id: ObjectId, type, item_id, created_at}` into `bookmarks` collection; returns `{bookmarked: true}`; idempotent (no duplicate if already bookmarked)
- [x] `DELETE /bookmarks/{item_id}` — removes bookmark for current user + that item_id; returns `{bookmarked: false}`
- [x] `GET /bookmarks` — query param `type: Optional[str]` — returns list of bookmarks for current user; each item includes the full question or case document joined from the respective collection
- [x] Router registered in `backend/app/main.py` with prefix `/api/v1/bookmarks`
- [x] All three endpoints use `current_user: str = Depends(get_current_user)` from `app.core.auth`
- [x] Typecheck passes

### US-002: Frontend — bookmark toggle in Question Bank session
**Description:** As a resident answering questions, I want to star a question mid-session so I can review it later.

**Acceptance Criteria:**
- [ ] New file `frontend/src/api/bookmarksApi.ts` with `addBookmark(type, itemId)`, `removeBookmark(itemId)`, `getBookmarks(type?)` using the authenticated apiClient
- [ ] In `frontend/src/pages/QuestionsPage.tsx`, the `ChainCard` component gains a bookmark icon button (★/☆) in its header area
- [ ] Clicking the icon calls `addBookmark("question", question_id)` or `removeBookmark(question_id)` and toggles the icon state
- [ ] Bookmark state is local to the card (no pre-fetching of existing bookmarks in the session view)
- [ ] Typecheck passes
- [ ] Verify changes work in browser

### US-003: Frontend — case bookmark + BookmarksPage
**Description:** As a resident, I want to bookmark a case from its detail page and review all my saved items in one place.

**Acceptance Criteria:**
- [ ] `frontend/src/pages/CaseDetailPage.tsx` has a bookmark icon button in the case header (same ★/☆ pattern as US-002)
- [ ] New file `frontend/src/pages/BookmarksPage.tsx` created
  - Two tab buttons: "Questions" and "Cases" (default: Questions)
  - Each tab fetches `GET /bookmarks?type=question` or `GET /bookmarks?type=case`
  - Each item row shows: title/stem (truncated 80 chars) + "→" link to `/questions/:id` or `/cases/:id` + remove button (✕) calling `removeBookmark`
  - Empty state per tab: "No bookmarked questions yet." / "No bookmarked cases yet."
- [ ] `frontend/src/router.tsx` has a protected route `/bookmarks` → `BookmarksPage`
- [ ] `frontend/src/components/Sidebar.tsx` has a "Bookmarks" nav link (added below History)
- [ ] Typecheck passes
- [ ] Verify changes work in browser

## Non-Goals

- No folder/collection organisation for bookmarks
- No shared bookmarks between users
- No bookmark notes or annotations (separate PRD)
- No bookmark count badges on nav items

## Technical Considerations

- `bookmarks` collection needs a compound index on `{user_id, item_id}` — add `db.bookmarks.create_index([("user_id", 1), ("item_id", 1)], unique=True)` in the POST endpoint or a startup script
- The GET /bookmarks join: collect all `item_id` values, batch-fetch from `questions` or `cases` collection using `{"question_id": {"$in": ids}}` / `{"case_id": {"$in": ids}}`, merge in Python
