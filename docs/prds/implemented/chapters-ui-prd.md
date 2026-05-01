# PRD: Chapters UI & Navigation

## Introduction

The chapters feature was displaying 492 chapters as a flat unstyled list with raw database
IDs (`p01_c001. Title`) instead of clean titles, and with no navigation between pages.
Residents had no way to browse by subject area, no back buttons, and no way to move between
sections without using the browser back button.

This PRD fixes the chapters hierarchy display, removes database ID prefixes, and adds
consistent navigation (back links, breadcrumbs, prev/next section controls) across all
chapter-related pages.

## Goals

- Group chapters by Harrison Part, displayed as a collapsible accordion
- Show clean `Chapter N: Title` format — no database key prefixes
- Add back links and breadcrumbs to ChapterDetailPage and SectionDetailPage
- Add prev/next section navigation inside SectionDetailPage
- Expose `part_number`, `part_title`, `chapter_number` from backend (already in MongoDB)

## User Stories

### US-001: Expose part/chapter fields from backend
**Description:** As a developer, I need the chapters API to return part and chapter number
fields so the frontend can group and sort correctly.

**Acceptance Criteria:**
- [x] `ChapterOut` schema in `backend/app/schemas/chapter.py` adds `part_number: Optional[int]`, `part_title: Optional[str]`, `chapter_number: Optional[int]`
- [x] `_doc_to_chapter_out()` in `backend/app/api/v1/routes/chapters.py` maps these fields from MongoDB doc
- [x] Typecheck passes

### US-002: Chapters list — accordion grouped by Part
**Description:** As a resident, I want to browse chapters organised by Harrison Part so
I can find topics without scrolling through 492 items.

**Acceptance Criteria:**
- [x] `ChaptersPage.tsx` groups chapters by `part_number` / `part_title`
- [x] Each Part renders as a collapsible accordion header: `Part N: {part_title} ({count} chapters)`
- [x] Part 1 expanded by default; all others collapsed
- [x] Chapters inside each Part sorted by `chapter_number` and displayed as `Ch. N  Title`
- [x] Raw database ID (`p01_c001`) no longer shown anywhere
- [x] `← Dashboard` back link at top
- [x] Typecheck passes

### US-003: Chapter detail — back link and breadcrumb
**Description:** As a resident, I want to know where I am in the book and be able to
navigate back without using the browser back button.

**Acceptance Criteria:**
- [x] `ChapterDetailPage.tsx` shows `← Back to Chapters` link at top
- [x] Breadcrumb below: `Chapters › Part N: {part_title}`
- [x] Chapter number label above title: `Chapter N`
- [x] Specialty badge displayed below title
- [x] Sections listed as numbered cards (not plain list items)
- [x] Typecheck passes

### US-004: Section detail — back link, breadcrumb, prev/next navigation
**Description:** As a resident, I want to read a section and move to the next one without
going back to the chapter page each time.

**Acceptance Criteria:**
- [x] `SectionDetailPage.tsx` shows `← Back to Chapter` link at top
- [x] Breadcrumb: `Chapters › {chapter_title} › {section_title}`
- [x] Section position indicator: `Section N of M`
- [x] Content rendered as paragraphs (split on `\n\n`) instead of one `<p>` block
- [x] Prev/Next section links at bottom of content, truncated with ellipsis if title is long
- [x] Parent chapter fetched in parallel with section content to populate sibling list
- [x] Typecheck passes

## Non-Goals

- No PDF rendering with images (separate PRD — requires AWS S3)
- No search within chapters
- No bookmarking or reading progress tracking
- No mobile-optimised layout changes

## Technical Considerations

- `part_number`, `part_title`, `chapter_number` already exist in every MongoDB chapter document
  (stored by `ingest_pdfs.py`) — backend change is additive only, no data migration needed
- `SectionDetailPage` fetches chapter and section in parallel via `Promise.all` to avoid
  waterfall latency
- Accordion state held in `useState<Set<number>>` — no persistence needed (session-only)
- All styling follows existing inline-style convention used across the app (no CSS framework)

## Files Changed

| File | Change |
|---|---|
| `backend/app/schemas/chapter.py` | Added `part_number`, `part_title`, `chapter_number` to `ChapterOut` |
| `backend/app/api/v1/routes/chapters.py` | Map new fields in `_doc_to_chapter_out()` |
| `frontend/src/api/chaptersApi.ts` | Added 3 fields to `Chapter` interface |
| `frontend/src/pages/ChaptersPage.tsx` | Rewritten — Part accordion, clean titles, back link |
| `frontend/src/pages/ChapterDetailPage.tsx` | Added back link, breadcrumb, numbered section cards |
| `frontend/src/pages/SectionDetailPage.tsx` | Added back link, breadcrumb, paragraph rendering, prev/next nav |
