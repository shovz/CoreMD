# PRD: UI Fixes — Sections Display, Bookmarks Back Button, Dashboard Alignment

## Introduction

Three layout and navigation bugs: (1) Chapter sections fail to render because the annotations fetch is coupled to section loading via Promise.all — if annotations fails, sections never appear; (2) Bookmarks page has no back-navigation and shows an unnecessary arrow icon; (3) Dashboard "Continue" card and "Focus Topics" card are vertically misaligned because the stats bar pushes Continue down while Focus Topics sits at the top of its column.

## Goals

- Chapter sections always render regardless of annotation fetch outcome
- Navigating from Bookmarks to a question/case shows a "← Back to Bookmarks" button
- Dashboard Continue and Focus Topics cards share the same top alignment

## User Stories

### US-001: Decouple annotations fetch from section loading
**Description:** As a resident, I want chapter sections to always display when I select a chapter, even if the annotations service is unavailable.

**Acceptance Criteria:**
- [x] In `frontend/src/pages/ChaptersPage.tsx` `handleChapterClick`, the `getAnnotationsByChapter` call is fire-and-forget — NOT part of a `Promise.all` with `getChapterById`
- [x] Pattern: call `getAnnotationsByChapter(chapterId).then(r => setAnnotations(r.data)).catch(() => setAnnotations([]))` independently; `getChapterById` and `getSectionById` proceed unconditionally
- [x] Selecting a chapter renders section content even when the backend returns an error for the annotations endpoint
- [x] Typecheck passes
- [x] Verify changes work in browser: select a chapter → section content renders

### US-002: Bookmarks — "Back to Bookmarks" button + remove arrow icon
**Description:** As a resident, I want to return to my bookmarks after opening a question or case from the bookmarks page, and I don't need the redundant arrow icon on each card.

**Acceptance Criteria:**
- [ ] In `frontend/src/pages/BookmarksPage.tsx`, the `<Link>` navigating to a question or case passes `state={{ from: "bookmarks" }}` via React Router's state prop
- [ ] The `→` span is removed from the `BookmarkRow` component
- [ ] `frontend/src/pages/QuestionDetailPage.tsx` reads `location.state?.from`; if `"bookmarks"`, renders a `<Link to="/bookmarks">← Back to Bookmarks</Link>` button at the top of the page
- [ ] `frontend/src/pages/CaseDetailPage.tsx` same: if `location.state?.from === "bookmarks"`, renders `← Back to Bookmarks` link at top
- [ ] `useLocation` is imported from `react-router-dom` in both detail pages
- [ ] Typecheck passes
- [ ] Verify changes work in browser: click a bookmark → opens detail page with back button → back button returns to /bookmarks

### US-003: Dashboard — align Continue and Focus Topics cards
**Description:** As a resident, I want the Continue and Focus Topics cards to appear side-by-side at the same vertical level on the dashboard.

**Acceptance Criteria:**
- [ ] In `frontend/src/pages/DashboardPage.tsx`, the stats bar row (streak/questions/accuracy pills) is moved OUTSIDE the 2-column grid to be full-width above it
- [ ] The 2-column grid contains ONLY the Continue card (left) and Focus Topics card (right) — both start at the same vertical position
- [ ] The empty state message (`Start by reading a chapter…`) remains below the stats bar
- [ ] All existing content (performance section, etc.) is unchanged
- [ ] Typecheck passes
- [ ] Verify changes work in browser

## Non-Goals

- No bookmark state stored in localStorage or URL params
- No changes to bookmark CRUD

## Technical Considerations

- `useLocation` is already imported in most pages via react-router-dom; add it where missing
- The `state` prop on `<Link>` is typed as `unknown` in React Router v6 — access as `(location.state as { from?: string })?.from`
- Back button style: `<Link to="/bookmarks" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mb-4">← Back to Bookmarks</Link>`
