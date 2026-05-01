# Inline Image Extraction — Implementation Explained

## 1. What Was Implemented and Why

Harrison's section viewer was text-only. Clinical images (ECGs, X-rays, diagrams) were
embedded in the source PDFs but never extracted — `pdf_service.py` explicitly skipped image
blocks. This meant the rendered HTML lacked all visual content from the book.

The feature adds inline image extraction: images are pulled from the PDF at their exact
reading-order position, saved as WebP files, and embedded in section HTML as `<img>` tags.
No frontend changes are needed because `SectionDetailPage` already renders `html_content`
via `dangerouslySetInnerHTML`, and DOMPurify allows `<img>` tags by default.

**Implementation status (as of this writing):**

| Story | Description | Status |
|-------|-------------|--------|
| US-001 | Update `pdf_service.py` to extract images inline | ✅ Done |
| US-002 | Update `extract_html_content.py` to pass `images_dir` | ⬜ Pending |
| US-003 | Mount `/static` in FastAPI | ⬜ Pending |

---

## 2. Key Design Decisions

### Images are emitted at block position, not appended at the end

PyMuPDF's `get_text("dict")` returns blocks in reading order — text and image blocks
interleaved. The loop processes them sequentially, so an `<img>` tag is appended to
`blocks_html` exactly where the image physically appears in the PDF column.

### `images_dir=None` preserves backward-compatible behaviour

`extract_page_html()` accepts two new optional keyword arguments (`chapter_id` and
`images_dir`). When both are absent (the default), the function behaves identically to
before — image blocks are still silently skipped. This means existing callers and tests
require no changes.

### 100×100 px minimum size filter

Decorative elements (horizontal rules, page borders, small icons) that happen to be
stored as image objects are filtered out before extraction. Only blocks with
`width >= 100` and `height >= 100` are processed.

### CMYK → RGB conversion

Some scanned medical images in Harrison's are stored as CMYK. Browsers cannot render CMYK
images. PyMuPDF's `Pixmap` exposes `pix.n - pix.alpha` as the number of colour channels;
a value `> 3` indicates CMYK, which is converted to RGB before saving.

### Stable, overwrite-safe filenames

Filename pattern: `{chapter_id}_p{page_num}_{xref}.webp`

`xref` (cross-reference number) is unique per image within a PDF. Combined with the page
number it produces a stable filename that is identical on every re-run, so re-extracting
a chapter simply overwrites the existing files rather than accumulating duplicates.

### WebP format

WebP provides good compression for both photographic (X-rays, photos) and line-art
(diagrams, ECGs) content and is supported in all modern browsers.

### Silent error swallowing per image

Each image extraction is wrapped in `try/except Exception: pass`. A corrupt `xref` or
unsupported colour space will skip that image without aborting the entire chapter
extraction.

---

## 3. MongoDB Document Shapes Produced

Image extraction writes files to disk, not to MongoDB. The `section_html` collection
documents are unchanged in schema — `html_content` is still a plain HTML string, but
it now contains `<img>` tags inline:

```json
{
  "section_id":   "p02_c015_s03",
  "chapter_id":   "p02_c015",
  "html_content": "<h2>ELECTROCARDIOGRAPHY</h2>\n<p>The standard 12-lead ECG...</p>\n<img src=\"/static/images/p02_c015_p142_1234.webp\" style=\"max-width:100%;margin:16px 0;\" alt=\"\" />\n<p>Lead placement...</p>",
  "updated_at":   "2026-04-18T10:00:00Z"
}
```

No schema additions to `chapters`, `ChapterOut`, or any other collection.

---

## 4. How to Run

### Prerequisites

- `backend/.env` is populated (MongoDB URI, PDF path)
- Harrison's full PDF is present at the path in `PDF_FULL_PATH`
- `ingest_pdfs.py` has already been run (chapters + sections must exist in MongoDB)

### Full extraction (writes to DB + disk)

```bash
cd backend
python scripts/extract_html_content.py
```

Progress is printed per chapter:
```
Part 2 | Chapter p02_c015 | 12 sections stored
```

After US-002 is implemented the line will also report image counts:
```
Part 2 | Chapter p02_c015 | 12 sections, 8 images
```

### Dry run (skips MongoDB writes, still writes image files to disk)

```bash
python backend/scripts/extract_html_content.py --dry-run
```

The `--dry-run` flag intentionally does not skip image file creation so image extraction
can be tested without touching the database.

### Serving images (requires US-003)

Once `app.mount("/static", StaticFiles(directory="static"), name="static")` is added to
`main.py`, images will be accessible at:

```
GET http://localhost:8000/static/images/{filename}.webp
```

`StaticFiles` resolves `directory="static"` relative to CWD, which is `backend/` when
the server is started with `python -m uvicorn app.main:app` from the `backend/` directory.

---

## 5. Files Changed

### `backend/app/services/pdf_service.py` (US-001 — done)

**What changed:** `extract_page_html()` gained two optional keyword parameters:

```python
def extract_page_html(
    pdf_path: str,
    page_start: int,
    page_end: int,
    chapter_id: str = "",
    images_dir: Optional[Path] = None,
) -> str:
```

The previous `if block.get("type") != 0: continue` (which skipped all non-text blocks)
was replaced with an explicit image-block handler. When `images_dir` is provided and
`chapter_id` is non-empty, image blocks are extracted, saved as WebP, and inserted into
`blocks_html` as `<img>` tags. Text-block processing is unchanged.

New imports added: `Optional` from `typing`, `Path` from `pathlib`.

---

### `backend/scripts/extract_html_content.py` (US-002 — pending)

**What needs to change:** The `extract_page_html()` call currently passes no `images_dir`:

```python
# Current (no image extraction)
html_content = extract_page_html(args.pdf_path, page_start - 1, page_end - 1)
```

Pending changes:
- Add `IMAGES_DIR = Path(__file__).parent.parent / "static" / "images"` constant
- Call `IMAGES_DIR.mkdir(parents=True, exist_ok=True)` near the top of `main()`
- Pass `chapter_id=chapter_id, images_dir=IMAGES_DIR` to `extract_page_html()`
- Count per-chapter images using `len(list(IMAGES_DIR.glob(f"{chapter_id}_*.webp")))`
  before and after the call, and include the delta in the progress line

---

### `backend/app/main.py` (US-003 — pending)

**What needs to change:** Add static file serving after `app = FastAPI(...)`:

```python
from fastapi.staticfiles import StaticFiles

app.mount("/static", StaticFiles(directory="static"), name="static")
```

`StaticFiles` raises on startup if the directory is missing, so `backend/static/images/`
must exist. A `.gitkeep` file in that directory ensures it is tracked by git.

---

### `backend/static/images/.gitkeep` (US-002 — pending)

Empty placeholder file. Ensures `backend/static/images/` is committed to the repository
so the `StaticFiles` mount does not fail on a fresh checkout before the extraction script
has been run.

---

## 6. Key Learnings

From `progress.txt`, the following project-level learnings are relevant to this feature
area:

- **PyMuPDF block structure:** `get_text("dict")` returns a nested structure of
  `blocks → lines → spans`. Each block has a `type` field: `0` = text, `1` = image.
  Image blocks expose `xref`, `width`, and `height` directly on the block dict.
  Font `size` and `flags` on spans (bold = `flags & 16`, italic = `flags & 2`) are used
  for heading detection in the text path.

- **All-caps short lines are reliable heading indicators** in Harrison's. The text
  extraction path uses this heuristic (`len <= 80`, all alphabetic chars uppercase) to
  emit `<h2>` tags, which `split_html_into_sections()` then uses to slice the chapter
  HTML into per-section documents.

- **Re-running is safe:** `extract_html_content.py` upserts by `section_id`, and image
  filenames are stable (same `xref` produces the same filename). Both operations are
  idempotent.
