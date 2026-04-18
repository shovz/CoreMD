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
- [x] `backend/scripts/ingest_pdfs.py` created with config constants (MONGO_URI, OPENAI_API_KEY, CHUNK_MAX_TOKENS=800, CHUNK_OVERLAP_TOKENS=100)
- [x] `backend/scripts/__init__.py` created (empty)
- [x] `pymupdf` and `tiktoken` added to `backend/requirements.txt`
- [x] Config uses `PDF_FULL_PATH` pointing to `Harrison Book/Harrison's_Principles_of_Internal_Medicine,_Twenty_First_Edition.pdf` (not PDF_DIR for Part PDFs)
- [x] Script runs without import errors: `python backend/scripts/ingest_pdfs.py --help`
- [x] Typecheck passes

### US-002: TOC extraction and chapter boundary detection
**Description:** As a developer, I need to extract the table of contents from the full
Harrison's PDF so I know each chapter's title, part, and page range.

**Acceptance Criteria:**
- [x] Function `extract_chapters_from_toc(pdf_path) -> list[dict]` opens the full Harrison's PDF and parses all 580 TOC entries
- [x] Identifies level-1 Part entries to track current `part_number` and `part_title` as chapters are iterated
- [x] Treats level-2 and level-3 entries whose title starts with a digit as chapters
- [x] Each returned dict contains: `chapter_number` (int, from leading digits in title), `title` (str), `part_number` (int), `part_title` (str), `page_start` (int), `page_end` (int, derived from next entry)
- [x] Running `python backend/scripts/ingest_pdfs.py --list-chapters` prints all 492 chapters to stdout
- [x] Typecheck passes

### US-003: Text extraction and chapter storage in MongoDB
**Description:** As a developer, I need to extract cleaned text for each chapter and
store the chapter document in MongoDB.

**Acceptance Criteria:**
- [x] Function `extract_text(doc, page_start, page_end) -> str` extracts and cleans text (strips page numbers, excessive whitespace, hyphenated line breaks)
- [x] Function `store_chapter(db, chapter_data) -> str` upserts chapter to `chapters` collection using `chapter_id` as key; returns `chapter_id`
- [x] `chapter_id` format: `p{part_num:02d}_c{chapter_num:03d}` (e.g. `p02_c015`)
- [x] `specialty` field derived from part title (e.g. "Disorders of the Cardiovascular System" → "Cardiology")
- [x] `sections` field populated as empty list at this stage (filled in US-004)
- [x] Idempotent: if `chapter_id` already exists in MongoDB, skip
- [x] Typecheck passes

### US-004: Hybrid text chunking with section detection
**Description:** As a developer, I need to split chapter text into chunks that respect
section boundaries and stay under 800 tokens.

**Acceptance Criteria:**
- [x] Function `detect_sections(text) -> list[dict]` identifies section headings using regex (all-caps lines or Title Case lines ≥ 3 words followed by newline)
- [x] Function `chunk_section(section_text, section_title, section_id) -> list[dict]` splits text at 800-token cap with 100-token overlap using `tiktoken cl100k_base` encoding
- [x] Each chunk dict contains: `chunk_id`, `chapter_id`, `section_id`, `section_title`, `text`, `token_count`, `chunk_index`
- [x] Chapter with no detected sections treated as one section titled "Overview"
- [x] `sections` field on the chapter document updated with `[{"id": section_id, "title": section_title}]` for each unique section
- [x] Typecheck passes

### US-005: Embedding generation and text_chunks storage
**Description:** As a developer, I need to generate OpenAI embeddings for each chunk
and store them in MongoDB so the AI assistant can do vector search later.

**Acceptance Criteria:**
- [x] Function `generate_embeddings(texts: list[str]) -> list[list[float]]` calls OpenAI `text-embedding-3-small` in batches of 100
- [x] Function `store_chunks(db, chunks: list[dict])` bulk-upserts chunks to `text_chunks` collection using `chunk_id` as key
- [x] Progress printed to stdout: `Part 2 | Chapter 15/47 | 12 chunks stored`
- [x] Script handles OpenAI rate limit errors with exponential backoff (max 3 retries)
- [x] On completion prints: total chapters, total chunks, total tokens processed
- [x] Typecheck passes

### US-006: Wire chapters API to MongoDB
**Description:** As a developer, I need the existing chapters API routes to read from
MongoDB instead of returning hardcoded fake data, so the frontend shows real content.

**Acceptance Criteria:**
- [x] `GET /chapters/` queries `db.chapters` collection, returns all chapters as `List[ChapterOut]`
- [x] `GET /chapters/{chapter_id}` queries by `chapter_id` field, raises 404 if not found
- [x] `GET /chapters/{chapter_id}/sections/{section_id}` queries `text_chunks` by `chapter_id` + `section_id`, concatenates chunk texts, returns as `content` field
- [x] All three routes still require valid JWT (existing auth guard unchanged)
- [x] `ChapterOut.id` mapped from MongoDB `chapter_id` field
- [x] Typecheck passes
- [x] Verify changes work in browser: chapters list shows real Harrison's chapters

## Non-Goals

- No admin UI for triggering ingestion — script only
- No image extraction from PDFs (text-only MVP)
- No re-ingestion or update mechanism (one-time only)
- No question bank seeding (separate PRD)
- No AI/RAG endpoint implementation (separate PRD)
- Part 21 (Index PDF) is excluded from ingestion
- No progress bar UI in the frontend during ingestion

## Technical Considerations

- **Use the full Harrison's PDF** (not the Part PDFs): `Harrison Book/Harrison's_Principles_of_Internal_Medicine,_Twenty_First_Edition.pdf`
- The Part PDFs (`Harrison Book/By Chapters/`) have **no embedded TOC bookmarks** — `get_toc()` returns empty for all of them. The full book has 580 TOC entries covering all 492 chapters.
- **TOC structure in the full PDF:**
  - Level 1: Parts (e.g. `"PART 2 Cardinal Manifestations and Presentation of Diseases"`) and front matter
  - Level 2: Chapters (e.g. `"13 Pain: Pathophysiology and Management"`) **OR** Sections for Part 2 (e.g. `"SECTION 1 Pain"`)
  - Level 3: Actual chapters inside Part 2 sections (e.g. `"13 Pain: Pathophysiology and Management"`)
  - **Rule:** Treat all level 2 and level 3 entries that start with a number as chapters. Level 1 entries are Parts — use them to derive `part_title` and `specialty`.
- Chapters are numbered 1–492. Extract the leading number from the TOC title to get `chapter_number`.
- `chapter_id` format: `p{part_num:02d}_c{chapter_num:03d}` (e.g. `p02_c015`) — must be stable across re-runs
- `page_end` = next TOC entry's `page_start - 1` (last chapter ends at `doc.page_count - 1`)
- `specialty` field derived from Part title (e.g. `"Disorders of the Cardiovascular System"` → `"Cardiology"`)
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
