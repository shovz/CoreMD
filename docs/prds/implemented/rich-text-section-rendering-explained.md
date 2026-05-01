# Rich Text Section Rendering — Implementation Explained

## 1. What Was Implemented and Why

Section pages previously showed a flat block of plain text assembled by joining `text_chunks` with double-newlines. No heading hierarchy, no bold text, no paragraph structure. Reading Harrison content this way is uncomfortable compared to the actual textbook.

This feature adds structured HTML rendering: a one-time script re-reads the Harrison PDF with PyMuPDF, converts font-size and flag metadata to HTML tags, splits the chapter HTML into per-section pieces, and stores the result in a new `section_html` MongoDB collection. The section API endpoint then returns an `html_content` field alongside the existing `content` field, and the frontend renders it with DOMPurify sanitisation.

**Scope deliberately excluded:** image extraction (deferred to AWS/S3), table rendering (plain text fallback), re-generating embeddings (text_chunks collection is untouched).

---

## 2. Key Design Decisions

### Separate `section_html` collection instead of embedding in `chapters` or `text_chunks`
HTML content is 200–500 KB per chapter. Embedding it in the `chapters` collection would bloat every chapter list query. Keeping it in a dedicated collection means existing queries are unaffected and the data can be regenerated independently.

### Keep `content` (plain text) as the primary field
The `html_content` field is additive and optional (`Optional[str]`). The plain-text `content` field is unchanged — it continues to serve the RAG pipeline (embeddings and AI retrieval). The frontend falls back to plain-text rendering when `html_content` is null, so the feature degrades gracefully for sections not yet processed.

### Page indices: 1-based in MongoDB, 0-based in PyMuPDF
MongoDB stores `page_start`/`page_end` as 1-based page numbers (from `get_toc()`). PyMuPDF `fitz.Document` uses 0-based indices. The script adjusts with `page_start - 1` / `page_end - 1`.

### Font-size thresholds for heading detection
Harrison uses consistent typography: body text at ~10–11pt, sub-headings at 12–14pt, section titles at ≥14pt. The thresholds (`>= 14` → `<h2>`, `>= 12` → `<h3>`) were chosen to match this. An additional ALL-CAPS short-line heuristic (≤80 characters, fully uppercase) catches headings set in small caps or at body font size.

### Section splitting via heading-text matching
After extracting full-chapter HTML, the script splits it into per-section slices by scanning `<h2>`/`<h3>` tags and matching their text (stripped of tags, uppercased) against section titles stored in the chapter document. Lines before the first matched heading flow into the first section by default.

### DOMPurify on the frontend
HTML is generated from our own controlled PDF, so XSS risk is low. DOMPurify is still applied as good practice — it prevents any malformed or injected markup from reaching the DOM.

---

## 3. MongoDB Document Shapes

### `section_html` collection (new)

```json
{
  "section_id":   "ch15_sec3",
  "chapter_id":   "ch15",
  "html_content": "<h2>PATHOPHYSIOLOGY</h2>\n<p>The <strong>primary</strong> mechanism...</p>",
  "updated_at":   "2026-04-18T10:23:00Z"
}
```

Indexed (implicitly via upsert filter) on `section_id`. The `chapter_id` field is stored for reference but queries always use `chapter_id + section_id` together to match the existing route structure.

### `chapters` collection (unchanged)

Existing shape — `chapter_id`, `page_start`, `page_end`, `sections: [{id, title}]`, `part_number`, `chapter_number` — is read by the script but never modified.

---

## 4. How to Run

### Prerequisites
- Harrison PDF at the path configured in `PDF_FULL_PATH` (defaults to `Harrison Book/Harrison's_Principles_of_Internal_Medicine,_Twenty_First_Edition.pdf` relative to the repo root).
- MongoDB running with chapters already ingested (`ingest_pdfs.py` must have run first).
- Python environment with `pymupdf` and `pymongo` installed (`requirements.txt`).

### Run the extraction script

```bash
# From the repo root:
python backend/scripts/extract_html_content.py

# Dry-run (no writes, shows progress only):
python backend/scripts/extract_html_content.py --dry-run

# Override PDF path:
python backend/scripts/extract_html_content.py --pdf-path "/path/to/harrisons.pdf"
```

Progress output example:
```
Found 480 chapters to process.

Part 1 | Chapter ch01 | 5 sections stored
Part 1 | Chapter ch02 | 3 sections stored
...
```

The script is **idempotent** — re-running it upserts (updates if exists, inserts if not) and is safe to repeat after adding new chapters or adjusting the HTML extraction logic.

### Start the dev stack

```bash
# Backend
cd backend && python -m uvicorn app.main:app --reload

# Frontend
cd frontend && npm run dev
```

---

## 5. Files Changed

| File | Action | What it does |
|---|---|---|
| `backend/app/services/pdf_service.py` | **Created** | `extract_page_html(pdf_path, page_start, page_end) -> str` — opens the PDF with `fitz.open()`, iterates pages, converts `get_text("dict")` block/line/span output to HTML. Bold (`flags & 16`) → `<strong>`, italic (`flags & 2`) → `<em>`, font ≥ 14pt or ALL-CAPS → `<h2>`, font ≥ 12pt → `<h3>`, everything else → `<p>`. Returns a fragment with no `<html>/<body>` wrapper. |
| `backend/scripts/extract_html_content.py` | **Created** | One-time population script. Reads all chapters from MongoDB, calls `extract_page_html()` for each, splits the result into per-section HTML via `split_html_into_sections()`, and bulk-upserts into the `section_html` collection. Supports `--dry-run` and `--pdf-path` flags. |
| `backend/app/schemas/chapter.py` | **Modified** | Added `SectionContentOut` Pydantic schema with `chapter_id`, `chapter_title`, `section_id`, `section_title`, `content: str`, `html_content: Optional[str]`. Used as the typed response model for the section endpoint. |
| `backend/app/api/v1/routes/chapters.py` | **Modified** | `GET /chapters/{chapter_id}/sections/{section_id}` now queries `section_html` collection for `html_content` and includes it in the `SectionContentOut` response (null when no document exists). |
| `frontend/src/api/sectionApi.ts` | **Modified** | Added `html_content: string \| null` to the `SectionResponse` interface to match the new backend field. |
| `frontend/src/pages/SectionDetailPage.tsx` | **Modified** | Renders `html_content` via `<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(section.html_content) }} className="section-content" />` when present; falls back to the existing paragraph-split plain-text render when null. |
| `frontend/src/index.css` | **Modified** | Added `.section-content` CSS scope block: line-height, paragraph spacing, heading font sizes (h1–h4), bold, and italic styles. Placed in the global stylesheet rather than a CSS module to keep all text typography in one place. |

---

## 6. Key Learnings from Implementation

**PyMuPDF `get_text("dict")` structure:** Returns a nested structure `blocks → lines → spans`. Each span carries `size` (float, pt) and `flags` (bitmask: bold = bit 4 = `& 16`, italic = bit 1 = `& 2`). The dominant (max) font size across a block's lines determines whether the block is a heading.

**ALL-CAPS heuristic is reliable for Harrison:** Harrison uses consistent all-caps for section titles at body font size. Checking `text == text.upper() and len(text) <= 80` catches these reliably without depending on font size alone.

**Page number offset:** MongoDB stores 1-based page numbers from PyMuPDF's `get_toc()`. PyMuPDF's `doc[n]` is 0-based. Always subtract 1 when passing `page_start`/`page_end` to `extract_page_html()`.

**Section splitting fallback:** When a chapter has only one section, the entire chapter HTML is assigned to that section without any heading-matching logic.

**`html_content` truthiness check:** The TypeScript interface uses `string | null`. The component checks `if (section.html_content)` rather than a strict null check so that both `null` and `""` (empty string from a failed extraction) fall through to plain-text rendering.

**Global CSS over CSS modules for prose styles:** `.section-content` scoped styles (heading sizes, line-height, bold) belong in `index.css` alongside other global typography. Using a CSS module for this would require passing class names through and would split text-rendering concerns across files.

**`dompurify` install pattern:** `dompurify` is a runtime dependency; `@types/dompurify` is a devDependency. Getting this wrong causes type errors in development or a missing import at runtime.
