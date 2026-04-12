# PRD: PDF Ingestion Pipeline

## Introduction

CoreMD's chapter explorer, question bank, and AI assistant all depend on Harrison's
Principles of Internal Medicine content being stored in MongoDB. Currently, the chapters
API returns hardcoded fake data. This pipeline extracts real content from the 20 Part PDFs,
chunks and embeds it, stores it in MongoDB, and wires the existing API to serve real data.

This is a one-time setup script — Harrison's 21st Edition content does not change.

## Goals

- Extract chapter and section structure from all 20 Part PDFs using embedded TOC bookmarks
- Store ~450 chapters as documents in the MongoDB `chapters` collection
- Produce text chunks (800 tokens max, section-aware) stored in `text_chunks` collection
- Generate embeddings for every chunk using OpenAI `text-embedding-3-small`
- Replace hardcoded fake data in chapters API with real MongoDB queries
- Script is idempotent: re-running skips already-processed chapters

## User Stories

### US-001: Script skeleton + dependencies
**Description:** As a developer, I need the ingestion script file and its dependencies
installed so the script can be run.

**Acceptance Criteria:**
- [x] `backend/scripts/ingest_pdfs.py` created with config constants (PDF_DIR, MONGO_URI, OPENAI_API_KEY, CHUNK_MAX_TOKENS=800, CHUNK_OVERLAP_TOKENS=100)
- [x] `backend/scripts/__init__.py` created (empty)
- [x] `pymupdf` and `tiktoken` added to `backend/requirements.txt`
- [x] Script runs without import errors: `python backend/scripts/ingest_pdfs.py --help`
- [x] Typecheck passes

### US-002: TOC extraction and chapter boundary detection
**Description:** As a developer, I need to extract the table of contents from each Part
PDF so I know each chapter's title and page range.

**Acceptance Criteria:**
- [x] Function `extract_chapters_from_pdf(pdf_path) -> list[dict]` implemented using `fitz.open()` and `doc.get_toc()`
- [x] Each returned dict contains: `title`, `page_start`, `page_end`, `chapter_number`
- [x] If TOC is empty or unreadable, logs a warning and returns empty list (skip that PDF)
- [x] Tested manually: running on one Part PDF prints chapter titles to stdout
- [x] Typecheck passes

### US-003: Text extraction and chapter storage in MongoDB
**Description:** As a developer, I need to extract cleaned text for each chapter and
store the chapter document in MongoDB.

**Acceptance Criteria:**
- [ ] Function `extract_text(doc, page_start, page_end) -> str` extracts and cleans text (strips page numbers, excessive whitespace, hyphenated line breaks)
- [ ] Function `store_chapter(db, chapter_data) -> str` upserts chapter to `chapters` collection using `chapter_id` as key; returns `chapter_id`
- [ ] `chapter_id` format: `p{part_num:02d}_c{chapter_num:03d}` (e.g. `p02_c015`)
- [ ] `specialty` field derived from part title (e.g. "Disorders of the Cardiovascular System" → "Cardiology")
- [ ] `sections` field populated as empty list at this stage (filled in US-004)
- [ ] Idempotent: if `chapter_id` already exists in MongoDB, skip
- [ ] Typecheck passes

### US-004: Hybrid text chunking with section detection
**Description:** As a developer, I need to split chapter text into chunks that respect
section boundaries and stay under 800 tokens.

**Acceptance Criteria:**
- [ ] Function `detect_sections(text) -> list[dict]` identifies section headings using regex (all-caps lines or Title Case lines ≥ 3 words followed by newline)
- [ ] Function `chunk_section(section_text, section_title, section_id) -> list[dict]` splits text at 800-token cap with 100-token overlap using `tiktoken cl100k_base` encoding
- [ ] Each chunk dict contains: `chunk_id`, `chapter_id`, `section_id`, `section_title`, `text`, `token_count`, `chunk_index`
- [ ] Chapter with no detected sections treated as one section titled "Overview"
- [ ] `sections` field on the chapter document updated with `[{"id": section_id, "title": section_title}]` for each unique section
- [ ] Typecheck passes

### US-005: Embedding generation and text_chunks storage
**Description:** As a developer, I need to generate OpenAI embeddings for each chunk
and store them in MongoDB so the AI assistant can do vector search later.

**Acceptance Criteria:**
- [ ] Function `generate_embeddings(texts: list[str]) -> list[list[float]]` calls OpenAI `text-embedding-3-small` in batches of 100
- [ ] Function `store_chunks(db, chunks: list[dict])` bulk-upserts chunks to `text_chunks` collection using `chunk_id` as key
- [ ] Progress printed to stdout: `Part 2 | Chapter 15/47 | 12 chunks stored`
- [ ] Script handles OpenAI rate limit errors with exponential backoff (max 3 retries)
- [ ] On completion prints: total chapters, total chunks, total tokens processed
- [ ] Typecheck passes

### US-006: Wire chapters API to MongoDB
**Description:** As a developer, I need the existing chapters API routes to read from
MongoDB instead of returning hardcoded fake data, so the frontend shows real content.

**Acceptance Criteria:**
- [ ] `GET /chapters/` queries `db.chapters` collection, returns all chapters as `List[ChapterOut]`
- [ ] `GET /chapters/{chapter_id}` queries by `chapter_id` field, raises 404 if not found
- [ ] `GET /chapters/{chapter_id}/sections/{section_id}` queries `text_chunks` by `chapter_id` + `section_id`, concatenates chunk texts, returns as `content` field
- [ ] All three routes still require valid JWT (existing auth guard unchanged)
- [ ] `ChapterOut.id` mapped from MongoDB `chapter_id` field
- [ ] Typecheck passes
- [ ] Verify changes work in browser: chapters list shows real Harrison's chapters

## Non-Goals

- No admin UI for triggering ingestion — script only
- No image extraction from PDFs (text-only MVP)
- No re-ingestion or update mechanism (one-time only)
- No question bank seeding (separate PRD)
- No AI/RAG endpoint implementation (separate PRD)
- Part 21 (Index PDF) is excluded from ingestion
- No progress bar UI in the frontend during ingestion

## Technical Considerations

- PDF path: `Harrison Book/By Chapters/` (relative to project root)
- Skip `PART 21` (index only, 98 MB, no chapter content)
- PyMuPDF TOC levels: level 1 = chapter, level 2+ = sub-section headings
- `chapter_id` must be stable across re-runs (deterministic from part + chapter number)
- OpenAI embedding dimensions: 1536 (`text-embedding-3-small`)
- Load `OPENAI_API_KEY` and `MONGO_URI` from `backend/.env` via `python-dotenv`
- MongoDB `text_chunks` will need a vector search index for RAG (set up in a later PRD)
- Existing `ChapterOut` schema (`id`, `title`, `specialty`, `sections`) requires no changes

### MongoDB Document Shapes

**`chapters` collection:**
```json
{
  "chapter_id": "p02_c015",
  "part_number": 2,
  "part_title": "Cardinal Manifestations and Presentation of Diseases",
  "chapter_number": 15,
  "title": "Chest Pain",
  "specialty": "Cardiology",
  "page_start": 89,
  "page_end": 95,
  "source_pdf": "PART 2 Cardinal Manifestations and Presentation of Diseases.pdf",
  "sections": [
    {"id": "p02_c015_s00", "title": "Overview"},
    {"id": "p02_c015_s01", "title": "Pathophysiology"}
  ]
}
```

**`text_chunks` collection:**
```json
{
  "chunk_id": "p02_c015_s01_chunk_0",
  "chapter_id": "p02_c015",
  "section_id": "p02_c015_s01",
  "section_title": "Pathophysiology",
  "text": "Chest pain arises from...",
  "embedding": [0.023, "...1536 floats"],
  "token_count": 412,
  "chunk_index": 0
}
```

### Files to Create / Modify

| File | Action |
|---|---|
| `backend/scripts/ingest_pdfs.py` | Create |
| `backend/scripts/__init__.py` | Create (empty) |
| `backend/requirements.txt` | Add `pymupdf`, `tiktoken` |
| `backend/app/api/v1/routes/chapters.py` | Replace fake data with MongoDB queries |
