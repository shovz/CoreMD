# PRD: Chapter Reader — Note Bubbles + Refs Modal

## Introduction

Two enhancements to make the chapter reader and case study pages more useful: (1) annotated text in the chapter reader should show a small numbered badge above the first word so readers can find their notes without opening the sidebar — hovering the annotated span underlines it and the sidebar notes should be numbered and scroll-to the annotation on click; (2) the References badge on a case study page should open an in-page modal with a section browser for the linked Harrison's chapter, so users can read the reference without leaving the case.

## Goals

- Annotated text (notes) shows a floating numbered bubble above the selected text; hovering underlines it
- The sidebar notes panel shows matching numbers and clicking a note scrolls the reader to that annotation
- The References badge on CaseDetailPage opens a modal with the referenced chapter's sections browsable inline
- No page navigation required to read a reference

## User Stories

### US-001: Chapter reader — numbered note bubbles + hover style + CSS
**Description:** As a resident, I want to see small numbered markers above text I have annotated with notes, so I can locate my notes while reading without opening the sidebar.

**Acceptance Criteria:**
- [x] `frontend/src/index.css` — add `.annotation-note` ruleset: `position: relative; text-decoration: underline dotted #92400e; cursor: pointer;` with a `::before` pseudo-element using `content: attr(data-note-num)` positioned `top: -18px; left: 0` with amber-brown background, white text, 10px font, border-radius 4px
- [x] `.annotation-note:hover` — add `background-color: #fef3c7; border-radius: 2px`
- [x] `frontend/src/pages/ChaptersPage.tsx` — extend `displayHtml` useMemo to also process notes (annotations where `note_text !== ""` and `section_id` matches current section): wrap each match in `<span class="annotation-note" data-note-id="${ann.id}" data-note-num="${i+1}">$&</span>` where `i` is the 0-based index of that note among all notes in this section (so `data-note-num` starts at 1)
- [x] Highlights (note_text === "") continue to use `<mark class="annotation-highlight">` unchanged
- [x] Typecheck passes
- [x] Verify in browser: add a note → annotated text shows small amber number badge above it; hover the span → text underlines

### US-002: Chapter reader — sidebar notes numbered + scroll-to-annotation
**Description:** As a resident, I want the notes sidebar to show each note's number (matching the in-text badge) and clicking a sidebar note should scroll that annotation into view in the reading pane.

**Acceptance Criteria:**
- [ ] `frontend/src/pages/ChaptersPage.tsx` — in the notes sidebar panel, derive `sectionNotes` (annotations with `note_text !== ""` and `section_id === sectionContent?.section_id`)
- [ ] Each note card in the sidebar shows a small circular number badge (matching the in-text `data-note-num`) before the selected_text snippet
- [ ] Clicking a note card calls `document.querySelector('[data-note-id="${ann.id}"]')?.scrollIntoView({ behavior: "smooth", block: "center" })`
- [ ] Highlights (note_text === "") in the sidebar still display as "🔖 Highlight" with no number badge and no scroll behaviour
- [ ] Sidebar shows ALL annotations (highlights + notes) in insertion order; only notes get number badges and click-to-scroll
- [ ] Typecheck passes
- [ ] Verify in browser: sidebar note card shows number → click → reader pane scrolls to the annotated text

### US-003: CaseDetailPage — refs modal with section browser
**Description:** As a resident studying a case, I want to click the References badge and read the linked Harrison's chapter section in a modal — without leaving the case page or losing my place in the questions.

**Acceptance Criteria:**
- [ ] `frontend/src/pages/CaseDetailPage.tsx` — add imports: `getChapterById, type Chapter` from `../api/chaptersApi`, `getSectionById, type SectionResponse` from `../api/sectionApi`, `DOMPurify` from `dompurify`
- [ ] Add state: `showRefModal` (boolean), `refChapter` (Chapter | null), `refSectionIdx` (number, default 0), `refSectionContent` (SectionResponse | null), `refLoading` (boolean)
- [ ] `handleOpenRef()` — sets `showRefModal = true`, calls `getChapterById(caseData.chapter_id)`, stores result in `refChapter`, then loads first section content into `refSectionContent`
- [ ] `handleRefSectionChange(idx)` — calls `getSectionById(chapter_id, sections[idx].id)` and updates `refSectionContent` and `refSectionIdx`
- [ ] The static `<span>` references badge (inside the Discussion panel, bottom) becomes a `<button onClick={handleOpenRef}>` with hover styles
- [ ] The small `<span>` chapter badge in the header area (top right) also becomes a `<button onClick={handleOpenRef}>` for discoverability
- [ ] Modal: fixed inset-0 overlay (z-50, semi-transparent black backdrop), inner panel max-w-4xl h-[75vh], two-pane layout: left nav (section list, ~200px wide) + right content (scrollable, `section-content` class for styling); header row with chapter title + × close button
- [ ] Clicking × or the backdrop closes the modal (`setShowRefModal(false)`)
- [ ] Section content rendered via `dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(refSectionContent.html_content) }}`
- [ ] Modal only renders when `showRefModal` is true
- [ ] Typecheck passes
- [ ] Verify in browser: open a case → click refs badge → modal opens with chapter sections list → click a section → content loads → × closes modal

## Non-Goals

- No annotation or note-taking within the refs modal
- No search within the refs modal
- Only one referenced chapter per case is supported (current data model has a single `chapter_id` per case)

## Technical Considerations

- `caseData.chapter_id` is a MongoDB ObjectId string, compatible with `getChapterById(id)`
- `getSectionById` is at `frontend/src/api/sectionApi.ts` — already used in `ChaptersPage.tsx`
- `DOMPurify` is already a project dependency (used in `ChaptersPage.tsx`)
- The refs modal is rendered inside the page's JSX return, after the main content `</div>`; it uses `fixed` positioning so it overlays correctly regardless of scroll position
