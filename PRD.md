# PRD: Rich Text Section Rendering

## Introduction

Section content is currently served as a single block of plain text concatenated from
text chunks. There is no heading hierarchy, no bold text, no paragraph structure beyond
double-newline splits. This makes reading Harrison content uncomfortable compared to the
original textbook.

This PRD adds structured HTML rendering to section pages by re-extracting text with
formatting metadata from the source PDF using PyMuPDF, storing the result in MongoDB,
and rendering it on the frontend. No new infrastructure required — images are deferred
to the AWS deployment phase.

## Goals

- Extract properly formatted HTML per section from the source PDF (headings, bold, paragraphs)
- Store HTML content in MongoDB so it is served without re-reading the PDF on every request
- Frontend renders HTML with sanitisation (DOMPurify)
- Fallback to plain text if HTML is not available for a section
- No impact on RAG pipeline (text_chunks and embeddings are unchanged)

## How It Works

1. Script opens the full Harrison PDF
2. For each chapter: extracts the page range using `page.get_text("dict")` (returns structured blocks with font size/flags)
3. Converts to HTML:
   - Large font or ALL CAPS line → `<h2>` or `<h3>`
   - Bold span (`flags & 16`) → `<strong>`
   - Italic span (`flags & 2`) → `<em>`
   - Regular span text → grouped into `<p>` blocks
4. Splits chapter HTML into per-section slices using section title markers
5. Upserts each section's HTML into a new `section_html` MongoDB collection
6. Section API endpoint returns `html_content` field alongside plain `content`
7. Frontend renders `html_content` with DOMPurify; fallback to `<p>` plain text

## User Stories

### US-001: PDF HTML extraction service
**Description:** As a developer, I need a service that opens the Harrison PDF and
extracts structured HTML for a given page range.

**Acceptance Criteria:**
- [x] `backend/app/services/pdf_service.py` created
- [x] `extract_page_html(pdf_path: str, page_start: int, page_end: int) -> str` opens the PDF with `fitz.open()`, iterates pages, converts `get_text("dict")` output to HTML
- [x] Font size ≥ 14 or ALL-CAPS short line → `<h2>`, font size ≥ 12 → `<h3>`, bold flag → `<strong>`, italic flag → `<em>`, everything else → `<p>`
- [x] Consecutive spans on same line are joined; blank lines between blocks become paragraph breaks
- [x] Returns clean HTML string (no `<html>/<body>` wrapper)
- [x] Typecheck passes

### US-002: Section HTML extraction script
**Description:** As a developer, I need a one-time script that populates the
`section_html` collection for all chapters.

**Acceptance Criteria:**
- [x] `backend/scripts/extract_html_content.py` created
- [x] Reads all chapters from MongoDB, sorts by `part_number`, `chapter_number`
- [x] For each chapter: calls `extract_page_html()` with `page_start`/`page_end` and PDF path (use `settings.PDF_PATH` or hardcoded constant matching ingest script)
- [x] Splits chapter HTML into sections using section titles from `chapter["sections"]` as heading markers
- [x] Upserts `{section_id, chapter_id, html_content, updated_at}` into `section_html` collection using `section_id` as key
- [x] Progress printed: `Part 2 | Chapter 15 | 4 sections stored`
- [x] Idempotent: safe to re-run
- [x] Typecheck passes

### US-003: Update section API endpoint
**Description:** As a developer, I need the section endpoint to return HTML content
when available so the frontend can render it.

**Acceptance Criteria:**
- [ ] `GET /chapters/{chapter_id}/sections/{section_id}` response adds `html_content: Optional[str]` field — populated from `section_html` collection if present, `null` otherwise
- [ ] `backend/app/schemas/chapter.py` adds `SectionContentOut` schema with `chapter_id`, `chapter_title`, `section_id`, `section_title`, `content`, `html_content: Optional[str]`
- [ ] Existing `content` (plain text) field kept for backwards compatibility and RAG
- [ ] Typecheck passes

### US-004: Frontend HTML rendering
**Description:** As a resident, I want section content to display with proper headings,
bold text, and paragraph structure matching the original Harrison textbook.

**Acceptance Criteria:**
- [ ] `dompurify` and `@types/dompurify` added to `frontend/package.json`
- [ ] `SectionDetailPage.tsx` checks `section.html_content`:
  - If present: renders via `<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(section.html_content) }} />`
  - If null: falls back to current paragraph-split plain text rendering
- [ ] CSS added to scope HTML content styles (headings, bold, line-height) within a `.section-content` wrapper
- [ ] `frontend/src/api/sectionApi.ts` adds `html_content: string | null` to `SectionResponse`
- [ ] Typecheck passes
- [ ] Verify in browser: a section page shows formatted headings and bold text

## Non-Goals

- No image extraction (deferred to AWS/S3 phase)
- No table rendering (plain text fallback for tables)
- No re-generation of embeddings (text_chunks collection unchanged)
- No streaming or lazy loading of content

## Technical Considerations

- PDF path: same constant as `ingest_pdfs.py` — `D:/JavaScript/Personal-Projects/Training/CoreMD/Harrison Book/Harrison's_Principles_of_Internal_Medicine,_Twenty_First_Edition.pdf`
- PyMuPDF already in `requirements.txt` — no new dependencies on the backend
- Section splitting: use the section titles stored in `chapter["sections"]` to find heading boundaries in the extracted HTML
- Font size thresholds will need tuning — Harrison uses consistent fonts; 10-11pt body, 12-14pt sub-headings
- `section_html` collection will be ~200–500 KB per chapter (text only), total ~100–250 MB
- DOMPurify prevents XSS; HTML is generated from our own PDF so risk is low but sanitisation is good practice

## Files to Create / Modify

| File | Action |
|---|---|
| `backend/app/services/pdf_service.py` | Create |
| `backend/scripts/extract_html_content.py` | Create |
| `backend/app/schemas/chapter.py` | Add `SectionContentOut` with `html_content` |
| `backend/app/api/v1/routes/chapters.py` | Update section endpoint response |
| `frontend/src/api/sectionApi.ts` | Add `html_content` to `SectionResponse` |
| `frontend/src/pages/SectionDetailPage.tsx` | Render HTML with DOMPurify fallback |
