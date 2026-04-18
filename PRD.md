# PRD: Inline Image Extraction

## Introduction

Harrison's section viewer displays text with formatting but no images. Clinical photos,
ECGs, X-rays, and diagrams are locked inside the PDFs. The `extract_html_content.py`
script already extracts text as HTML using PyMuPDF — it explicitly skips image blocks
at `backend/app/services/pdf_service.py:16` with `if block.get("type") != 0: continue`.

This PRD removes that skip and adds inline image support: images are extracted at their
exact document position (PyMuPDF returns blocks in reading order — text and image blocks
interleaved), saved as WebP files, and embedded in the section HTML as `<img>` tags.

No frontend changes are needed — `SectionDetailPage` already renders `html_content`
via `dangerouslySetInnerHTML` with DOMPurify, which allows `<img>` tags by default.

## Goals

- Images appear inline between paragraphs, exactly where they occur in the original PDF
- Images smaller than 100×100 px (decorative rules, page borders, icons) are skipped
- Re-running the script replaces existing `section_html` documents (already idempotent)
- FastAPI serves extracted images at `/static/images/`
- Full suite `pytest tests/` still passes after changes

## User Stories

### US-001: Update pdf_service to extract images inline

**Description:** As a developer, I need the HTML extraction function to emit `<img>` tags
inline at the exact position image blocks appear in the PDF reading order.

**Acceptance Criteria:**
- [x] `backend/app/services/pdf_service.py`: `extract_page_html()` updated to accept
  two new optional keyword args: `chapter_id: str = ""` and
  `images_dir: Optional[Path] = None` (import `Path` from `pathlib` and `Optional` from `typing`)
- [x] The existing `if block.get("type") != 0: continue` line is REMOVED
- [x] In the block loop, when `block.get("type") == 1` (image block):
  - Skip if `images_dir` is None or `chapter_id` is empty
  - Read `xref = block.get("xref", 0)`, `w = block.get("width", 0)`, `h = block.get("height", 0)`
  - Skip if `xref <= 0` or `w < 100` or `h < 100`
  - Extract: `pix = fitz.Pixmap(doc, xref)`
  - Convert CMYK: `if pix.n - pix.alpha > 3: pix = fitz.Pixmap(fitz.csRGB, pix)`
  - Filename: `f"{chapter_id}_p{page_num}_{xref}.webp"`
  - Save: `(images_dir / filename).write_bytes(pix.tobytes("webp"))`
  - Append to output: `f'<img src="/static/images/{filename}" style="max-width:100%;margin:16px 0;" alt="" />'`
  - Wrap in try/except Exception — skip image silently on any error
- [x] When `images_dir` is None, behaviour is identical to before (no images in output)
- [x] `python -c "from app.services.pdf_service import extract_page_html"` passes
- [x] Typecheck passes

### US-002: Update extract_html_content.py to pass images_dir

**Description:** As a developer, I need the extraction script to create the images directory
and pass it to `extract_page_html()` so images are saved and counted during the run.

**Acceptance Criteria:**
- [x] `IMAGES_DIR` constant defined: `Path(__file__).parent.parent / "static" / "images"`
- [x] Near the top of `main()`: `IMAGES_DIR.mkdir(parents=True, exist_ok=True)`
- [x] `extract_page_html()` call updated to pass `chapter_id=chapter_id, images_dir=IMAGES_DIR`
- [x] Count images saved per chapter: before and after the `extract_page_html()` call,
  count files in `IMAGES_DIR` matching `f"{chapter_id}_*.webp"` using `len(list(IMAGES_DIR.glob(...)))`
- [x] Progress line updated to: `Part {part_num} | Chapter {chapter_id} | {stored} sections, {img_count} images`
- [x] `backend/static/images/.gitkeep` created (empty file, keeps directory in repo)
- [x] `python backend/scripts/extract_html_content.py --dry-run` runs without errors
- [x] Typecheck passes

### US-003: Mount /static in FastAPI

**Description:** As a developer, I need FastAPI to serve extracted images at `/static/images/`
so the browser can load them from HTML content.

**Acceptance Criteria:**
- [x] `backend/app/main.py`: `from fastapi.staticfiles import StaticFiles` added
- [x] `app.mount("/static", StaticFiles(directory="static"), name="static")` added
  directly after the `app = FastAPI(...)` line, before route registrations
- [x] `python -c "import app.main"` passes (server starts without error; static dir
  may not exist yet — `StaticFiles` raises on mount only if directory is missing,
  so `.gitkeep` from US-002 ensures the directory exists)
- [x] `pytest tests/` passes — existing 30 tests unaffected
- [x] Typecheck passes

## Non-Goals

- No schema changes (`ChapterOut` does not need an `images` field)
- No frontend code changes (`SectionDetailPage` already handles inline `<img>`)
- No image resizing beyond WebP conversion
- No captions or figure labels extracted

## Technical Considerations

- `fitz.Pixmap(doc, xref)` is the correct PyMuPDF API for extracting by cross-reference
  number; `xref` is available as `block["xref"]` in type-1 blocks from `get_text("dict")`
- CMYK detection: `pix.n - pix.alpha > 3` (CMYK has 4 channels; RGB has 3)
- `xref` is unique per image in the PDF, so `<chapter_id>_p<page>_<xref>.webp` filenames
  are stable across re-runs — re-extracting the same page overwrites the same file
- `StaticFiles(directory="static")` resolves relative to CWD, which is `backend/`
  when running `python -m uvicorn app.main:app` from `backend/`
- The `--dry-run` flag in extract_html_content.py skips MongoDB writes but still
  creates image files on disk — this is intentional so image extraction can be tested
  without touching the database
- After implementing, run: `python backend/scripts/extract_html_content.py`
  This regenerates all 12,046 section HTML documents with inline images
