# PDF Ingestion Pipeline — Implementation Explained

## What This Is

A one-time Python script (`backend/scripts/ingest_pdfs.py`) that reads Harrison's
Principles of Internal Medicine (21st Ed.) and loads all of its content into MongoDB,
ready for the chapter explorer and AI assistant to use.

Before this was built, the chapters API returned hardcoded fake data (2 fake chapters).
After running this script, MongoDB contains all 492 real chapters with their full text,
split into searchable chunks with vector embeddings.

---

## Why We Built It This Way

### Single full-book PDF, not the Part PDFs

The Harrison's content was available as 20 Part PDFs (`By Chapters/`) and one complete
book PDF. We discovered that the Part PDFs have **no embedded TOC bookmarks** — PyMuPDF's
`get_toc()` returns empty for all of them. The full book PDF, however, has 580 TOC entries
covering all 492 chapters across 15,164 pages.

**Decision:** Use the full PDF as the single ingestion source. Simpler, more reliable,
and no cross-referencing needed.

### TOC-driven chapter extraction (not regex scanning)

Rather than scanning page text for patterns like "CHAPTER 15", we read the PDF's native
bookmark tree. This is exact (page numbers come directly from the PDF's internal structure)
and fast (no page-by-page scanning needed).

The TOC has 3 levels:
- Level 1 → Parts (e.g. "PART 6 Disorders of the Cardiovascular System")
- Level 2 → Chapters in most Parts, but Sections in Part 2 (e.g. "SECTION 1 Pain")
- Level 3 → Chapters inside Part 2 sections

**Rule applied:** Any level-2 or level-3 entry whose title starts with a digit is a chapter.
Leading digit → chapter number. Level-1 Part entries set the current Part context so each
chapter knows which Part and specialty it belongs to.

### Hybrid chunking (section-aware + 800-token cap)

Medical text has natural section breaks (headings like "PATHOPHYSIOLOGY", "CLINICAL
MANIFESTATIONS", "TREATMENT"). Splitting only on token counts would cut mid-section and
lose coherence. Splitting only on section boundaries risks huge sections exceeding the
LLM context window.

**Hybrid approach:**
1. Detect section headings via regex (all-caps lines OR Title Case ≥ 3 words)
2. Split text at each heading boundary
3. If a section exceeds 800 tokens → further split with 100-token overlap

This means chunks stay semantically coherent (about one topic) while staying within the
LLM context window. 100-token overlap prevents cutting sentences at chunk edges.

### OpenAI `text-embedding-3-small`

At ~3–9M tokens across all chapters, the total cost is under $0.20 for the whole book.
Embeddings are 1536 dimensions and are stored directly on each `text_chunks` document
so vector search can be added later without re-generating them.

### Idempotent design

The script checks if a `chapter_id` already exists in MongoDB before writing. Re-running
the script safely skips already-processed chapters. This matters because the full ingestion
takes time and could be interrupted.

---

## MongoDB Output

### `chapters` collection (~492 documents)

```json
{
  "chapter_id": "p06_c238",
  "part_number": 6,
  "part_title": "Disorders of the Cardiovascular System",
  "chapter_number": 238,
  "title": "238 Approach to the Patient with Possible Cardiovascular Disease",
  "specialty": "Cardiology",
  "page_start": 1823,
  "page_end": 1832,
  "source_pdf": "/path/to/Harrison's_Principles_..._Edition.pdf",
  "sections": [
    {"id": "p06_c238_s00", "title": "Overview"},
    {"id": "p06_c238_s01", "title": "THE HISTORY"},
    {"id": "p06_c238_s02", "title": "PHYSICAL EXAMINATION"}
  ]
}
```

### `text_chunks` collection (~5,000–15,000 documents)

```json
{
  "chunk_id": "p06_c238_s02_chunk_0",
  "chapter_id": "p06_c238",
  "section_id": "p06_c238_s02",
  "section_title": "PHYSICAL EXAMINATION",
  "text": "The physical examination begins with...",
  "embedding": [0.023, ...],
  "token_count": 412,
  "chunk_index": 0
}
```

---

## How to Run

```bash
cd backend
pip install -r requirements.txt

# Preview: list all 492 chapters without writing to DB
python scripts/ingest_pdfs.py --list-chapters

# Dry run: extract + print, no DB writes
python scripts/ingest_pdfs.py --dry-run

# Full ingestion (takes 20–60 min depending on API rate limits)
python scripts/ingest_pdfs.py
```

---

## What Changed in the Codebase

| File | Change |
|---|---|
| `backend/scripts/ingest_pdfs.py` | New — full ingestion script |
| `backend/scripts/__init__.py` | New — empty package marker |
| `backend/requirements.txt` | Added `pymupdf`, `tiktoken`, `openai` |
| `backend/app/api/v1/routes/chapters.py` | Replaced hardcoded fake data with real MongoDB queries |

---

## Key Learnings (discovered during implementation)

- Part PDFs have no TOC — always use the full book PDF
- `sys.stdout.reconfigure(encoding="utf-8", errors="replace")` needed on Windows for non-ASCII chapter titles
- PyMuPDF page numbers in `get_toc()` are 1-based; internal page index is 0-based
- `bulk_write(ordered=False)` is significantly faster than individual upserts for chunk storage
- `generate_embeddings` batches 100 texts per OpenAI call with exponential backoff on rate limits
