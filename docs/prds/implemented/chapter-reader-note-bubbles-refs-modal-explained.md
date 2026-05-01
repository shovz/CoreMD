# Chapter Reader — Note Bubbles + Refs Modal: Implementation Explained

## What Was Implemented and Why

Three UX enhancements were grouped into one PRD because they all improve how residents interact with annotated reading material.

**US-001 — Numbered note bubbles in the chapter reader**
Annotated text (annotations that have a `note_text`) now shows a small amber number badge floating above the first word of the annotated span. Before this change, a resident had to open the notes sidebar to discover where their notes were anchored in the text. The badge makes annotations visible at a glance while reading.

**US-002 — Sidebar notes numbered + click-to-scroll**
The notes sidebar already listed all annotations (highlights and notes). This story added matching number badges to note cards in the sidebar and made each note card clickable: clicking it smooth-scrolls the reading pane to the annotated span. Highlights continue to display as "🔖 Highlight" with no number and no click behaviour, since they have no note text to link back to.

**US-003 — References modal on CaseDetailPage**
The References badge on a case page previously showed the linked Harrison's chapter title as static text. Residents had to navigate away from the case to read the reference. The badge (and a matching chapter badge in the page header) is now a button that opens a full-section browser in a fixed modal overlay — two panes, section list on the left, HTML content on the right — without losing the resident's place in the case questions.

---

## Key Design Decisions

### US-001/002: `sectionNotes` as the single source of truth for numbering

Both the HTML injection (`displayHtml` useMemo) and the sidebar need to agree on which index (1, 2, 3…) each note has. A `sectionNotes` derived array is computed once:

```ts
const sectionNotes = useMemo(
  () => annotations.filter(
    (a) => a.note_text !== "" && a.section_id === sectionContent?.section_id
  ),
  [annotations, sectionContent?.section_id]
);
```

`displayHtml` iterates `notes` (same filter) with `.forEach((ann, i) => ...)` so `i + 1` matches `sectionNotes.indexOf(ann) + 1` in the sidebar. The sidebar checks `sectionNotes.indexOf(ann) !== -1` to decide whether a card gets a badge and a click handler.

### US-001: CSS `::before` pseudo-element, not a DOM sibling

The number bubble is rendered entirely in CSS using `content: attr(data-note-num)` on the `::before` pseudo-element of `.annotation-note`. This avoids injecting extra DOM nodes into the sanitized HTML string and keeps the regex replacement in `displayHtml` to a single `<span>` wrapper:

```html
<span class="annotation-note" data-note-id="..." data-note-num="1">selected text</span>
```

`pointer-events: none` on the pseudo-element ensures mouse events pass through to the span below.

### US-003: Two-step lazy loading for the refs modal

The modal opens immediately (before any data arrives), then fetches in sequence:

1. `getChapterById(caseData.chapter_id)` — loads the chapter title and the full sections list (lightweight metadata).
2. `getSectionById(chapter.id, chapter.sections[0].id)` — loads the HTML content of the first section.

Subsequent section clicks call `handleRefSectionChange(idx)`, which fetches only the selected section's content. This keeps the initial load fast and avoids fetching all sections upfront.

`refLoading` is set to `true` before both fetches and cleared in `finally`, so the right pane shows "Loading…" during any in-flight request.

### US-003: Backdrop-click close with `e.stopPropagation()` on the inner panel

The outer overlay uses `onClick={() => setShowRefModal(false)}` to close the modal when the user clicks the backdrop. The inner panel calls `onClick={(e) => e.stopPropagation()}` so clicks inside the panel do not bubble up and trigger the close handler. The `×` button calls `setShowRefModal(false)` directly.

### US-003: DOMPurify for section HTML in the modal

Section HTML content in the modal is passed through `DOMPurify.sanitize(refSectionContent.html_content)` before rendering via `dangerouslySetInnerHTML`. `DOMPurify` is already a project dependency (used identically in `ChaptersPage.tsx`), so no new package was needed. The modal content div uses `className="section-content prose prose-sm"` to inherit the same typographic styles as the main chapter reader.

### US-003: Two entry points for the modal

The refs modal can be opened from two places in `CaseDetailPage`:
- The chapter badge in the page header (top-right area) — for discoverability.
- The References badge inside the Discussion panel (bottom) — the natural reading flow.

Both call the same `handleOpenRef` handler.

---

## MongoDB Document Shapes Produced

No new documents, collections, or fields are written by any of these features.

- US-001/002: annotation documents already exist in the `annotations` collection (written by the notes/highlights feature). The number badges are computed client-side from the existing `note_text`, `section_id`, and `id` fields.
- US-003: reads existing `chapters` and `sections` documents via `GET /api/v1/chapters/{id}` and `GET /api/v1/chapters/{id}/sections/{section_id}`. No writes.

---

## How to Run / Verify

Start the frontend dev server:

```bash
cd frontend
npm run dev     # Vite on :5173
```

The backend must be running (US-003 fetches chapter and section data on modal open):

```bash
cd backend
python -m uvicorn app.main:app --reload   # FastAPI on :8000
```

**Verify US-001 (note bubbles):**
1. Open the chapter reader and navigate to any section.
2. Select some text, click "Add Note", type a note, and save.
3. The annotated text must show a small amber numbered badge (`1`) floating above it.
4. Hover the annotated text — background turns light amber and text shows a dotted underline.
5. Add a second note in the same section — it must show badge `2`.

**Verify US-002 (sidebar scroll-to):**
1. With notes added as above, open the notes sidebar.
2. Each note card must show a circular amber badge with the matching number.
3. Highlights must show "🔖 Highlight" with no badge.
4. Click a note card — the reading pane must smooth-scroll to place the annotated span in the center of the viewport.
5. Navigate to a different section — note cards from other sections must show no badge and must not be clickable.

**Verify US-003 (refs modal):**
1. Open any case that has a linked Harrison's chapter.
2. Click the References badge (Discussion panel) or the chapter badge (header) — the modal must open immediately with "Loading…" in the header.
3. Once loaded, the chapter title appears in the header and all sections are listed in the left nav.
4. The first section's content must render with the same styling as the main reader.
5. Click a different section in the left nav — content must update with a brief "Loading…" placeholder.
6. Click the `✕` button or the backdrop — modal must close.

TypeScript check:

```bash
cd frontend
npm run build   # tsc + vite build — must pass with no errors
```

---

## Files Changed

| File | What changed |
|------|-------------|
| `frontend/src/index.css` | Added `.annotation-note`, `.annotation-note::before`, and `.annotation-note:hover` rulesets |
| `frontend/src/pages/ChaptersPage.tsx` | Added `sectionNotes` memo; extended `displayHtml` to wrap notes in numbered `<span>`; updated sidebar to show number badges and click-to-scroll |
| `frontend/src/pages/CaseDetailPage.tsx` | Added refs modal state + handlers; converted static reference badges to buttons; added modal overlay JSX |

### `frontend/src/index.css`

Three new rulesets added after `.annotation-highlight`:

```css
.annotation-note {
  position: relative;
  text-decoration: underline dotted #92400e;
  cursor: pointer;
}

.annotation-note::before {
  content: attr(data-note-num);
  position: absolute;
  top: -18px;
  left: 0;
  background-color: #92400e;
  color: white;
  font-size: 10px;
  border-radius: 4px;
  padding: 0 3px;
  line-height: 1.4;
  pointer-events: none;
}

.annotation-note:hover {
  background-color: #fef3c7;
  border-radius: 2px;
}
```

`#92400e` is Tailwind's `amber-800`, matching the amber colour used for the circular badge in the sidebar.

### `frontend/src/pages/ChaptersPage.tsx`

**New `sectionNotes` memo** (line ~252): filters annotations to notes in the current section. Used by both `displayHtml` (for consistent numbering) and the sidebar (for badge + click).

**Extended `displayHtml` memo**: after processing highlights with `<mark class="annotation-highlight">`, iterates `notes` (same filter as `sectionNotes`) with `forEach((ann, i) => ...)` and replaces each match with:

```html
<span class="annotation-note" data-note-id="${ann.id}" data-note-num="${i + 1}">$&</span>
```

**Sidebar update**: for each annotation card, `noteIndex = sectionNotes.indexOf(ann)` determines whether it is a note in the current section (`noteIndex !== -1`). If so:
- A circular amber badge `{noteIndex + 1}` is rendered before the snippet.
- The card gets `cursor-pointer hover:border-amber-300` styles.
- `onClick` calls `document.querySelector('[data-note-id="${ann.id}"]')?.scrollIntoView({ behavior: "smooth", block: "center" })`.

### `frontend/src/pages/CaseDetailPage.tsx`

**New imports**: `getChapterById`, `type Chapter` from `../api/chaptersApi`; `getSectionById`, `type SectionResponse` from `../api/sectionApi`; `DOMPurify` from `dompurify`.

**New state**:

```ts
const [showRefModal, setShowRefModal] = useState(false);
const [refChapter, setRefChapter] = useState<Chapter | null>(null);
const [refSectionIdx, setRefSectionIdx] = useState(0);
const [refSectionContent, setRefSectionContent] = useState<SectionResponse | null>(null);
const [refLoading, setRefLoading] = useState(false);
```

**`handleOpenRef`**: sets `showRefModal = true` immediately, then fetches chapter metadata and the first section's HTML content. Both badge buttons in the JSX call this handler.

**`handleRefSectionChange(idx)`**: fetches section HTML for the selected index and updates `refSectionContent` and `refSectionIdx`.

**Modal JSX** (appended after the main content div, conditionally rendered on `showRefModal`):
- Outer `div`: `fixed inset-0 z-50 bg-black/50`, `onClick` closes modal.
- Inner panel: `max-w-4xl`, `height: 75vh`, `onClick` calls `e.stopPropagation()`.
- Header row: chapter title (or "Loading…") + `✕` close button.
- Body: left nav `w-48` listing all sections; right content `flex-1 overflow-y-auto` rendering sanitized HTML via `dangerouslySetInnerHTML`.

---

## Key Learnings

**Two-step modal loading keeps perceived performance high.** Opening the modal immediately and showing "Loading…" is faster-feeling than waiting for both the chapter list and section content before revealing the modal. The chapter metadata (section list) arrives first and populates the nav; the section content fills in shortly after. Users see progress rather than a frozen UI.

**`e.stopPropagation()` on the inner panel is essential for the backdrop-close pattern.** The outer overlay's `onClick` closes the modal. Without `stopPropagation()` on the inner panel, any click anywhere inside the modal (including on section nav buttons or scrolling the content) would bubble up and immediately close it. Every modal in the codebase that uses this pattern must apply `stopPropagation` on the inner container.

**A single derived array (`sectionNotes`) keeps numbering consistent across two sites.** If the HTML injection and the sidebar computed their own filtered lists independently, insertion order could diverge (e.g., if `useMemo` dependency ordering differed). Deriving both from the same `sectionNotes` memo guarantees that badge `2` in the sidebar always matches `data-note-num="2"` in the HTML.

**CSS `::before` with `content: attr(...)` avoids DOM fragmentation.** Injecting a sibling `<span>` for each badge number inside the sanitized HTML string would require more complex regex and could break mid-word spans. The CSS pseudo-element reads `data-note-num` from the existing wrapper span and renders visually above it — no additional HTML nodes needed.

**`refSectionContent.content` as a plain-text fallback.** The modal renders `html_content` if present, but falls back to `refSectionContent.content` (plain text) if `html_content` is falsy. This mirrors how `ChaptersPage` handles sections that were imported without HTML extraction.
