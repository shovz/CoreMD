# CoreMD — Architecture Options & Future Paths

This document captures every major technical decision made during CoreMD's MVP build,
the reasoning behind each choice, and the concrete upgrade paths available when the MVP
outgrows its current implementation.

Each section follows the same structure:
- **Current (MVP)** — what's running now and why
- **When to upgrade** — the signal that tells you the MVP approach is no longer enough
- **Option [X]** — each alternative with trade-offs, cost, and migration effort

---

## 1. PDF Storage

### Current (MVP)
PDFs live on the **local filesystem** inside the project directory
(`Harrison Book/By Chapters/` and the full book PDF). The ingestion script reads them
directly by path. This is a one-time operation — the book doesn't change.

### When to upgrade
When deploying to a cloud server (ECS, EC2, etc.) where the PDF won't be present on disk,
or when a second edition needs to be ingested by someone who doesn't have the file locally.

### Option A — AWS S3 (recommended for production)
Store the PDF in an S3 bucket. Update `PDF_FULL_PATH` in `.env` to an S3 URI, add
`boto3` to requirements, and update the ingestion script to download the file before
processing (or stream it via `fitz.open(stream=...)`).

- **Cost:** ~$0.023/GB/month. The full book (~500 MB) costs < $0.02/month.
- **Effort:** ~2 hours
- **Benefit:** Works from any machine, shareable with team

### Option B — MongoDB GridFS
Store the PDF inside MongoDB itself. Chunks the file into 255 KB pieces across two
collections. Simple for a single-database setup but slower than S3 for large binaries
and adds no real benefit over filesystem for a read-once workflow.

- **Cost:** $0 (uses existing MongoDB)
- **Effort:** ~1 hour
- **Not recommended** — overkill for a file that's only read during ingestion

---

## 2. TOC / Chapter Boundary Detection

### Current (MVP)
Uses the **full Harrison's book PDF** (`Harrison's_Principles_of_Internal_Medicine,
_Twenty_First_Edition.pdf`) which has 580 embedded TOC bookmarks. PyMuPDF's `get_toc()`
extracts all 492 chapter boundaries automatically.

### Why not the Part PDFs
The 20 Part PDFs (`By Chapters/`) have **no embedded TOC bookmarks** — `get_toc()`
returns empty for all of them. This was discovered during implementation.

### If the full book PDF is unavailable
**Option A — Regex page scanning:** Scan each page of the Part PDFs for patterns like
`"CHAPTER 15"` or `"^\\d+ "` at the start of a line. Fragile but workable.

**Option B — Manual chapter map JSON:** A JSON file mapping each Part to its chapters
with page numbers, maintained by hand. ~2 hours to create, perfectly reliable.

---

## 3. Text Embeddings

### Current (MVP)
**OpenAI `text-embedding-3-small`** — 1536-dimension vectors, batched in groups of 100.
Cost for the full Harrison's ingestion: ~$0.13 total (one-time).

### When to upgrade
If you need to re-ingest frequently (e.g., multiple textbooks), or if you want zero
ongoing cost for embeddings.

### Option A — Ollama + `nomic-embed-text` (FREE, local)
Run `ollama pull nomic-embed-text` and change the embedding call to hit
`http://localhost:11434/api/embeddings`. 768 dimensions (vs 1536), slightly lower quality
but free forever.

- **Cost:** $0
- **Effort:** ~1 hour (change embedding function + re-index)
- **Caveat:** Must re-generate all existing embeddings if you switch (dimensions change)
- **Speed:** Slow without GPU — budget 4–8 hours for full re-ingestion on CPU

### Option B — Google `text-embedding-004` (FREE tier)
Google AI Studio provides a free embedding API with generous daily limits. 768 dimensions.
Change the embedding call to use `google-generativeai` Python SDK.

- **Cost:** Free up to 1,500 requests/day; ~$0.00002/1K tokens paid
- **Effort:** ~30 minutes
- **Good middle ground** between free and quality

### Switching embeddings
Any switch requires re-generating all 15,673 chunks (different model = different vector
space, old vectors are useless). Run `db.text_chunks.updateMany({}, {$unset: {embedding: ""}})` 
then re-run the ingestion script with `--force-embeddings` flag (to be implemented).

---

## 4. Vector Search (RAG Retrieval)

### Current (MVP)
**Python cosine similarity** — loads all chunk embeddings from MongoDB into memory,
computes similarity with numpy, returns top-k results. Works with local Docker MongoDB.

- **Query time:** ~1–2 seconds
- **Memory:** ~96 MB per query (15,673 chunks × 1536 floats × 4 bytes)
- **Cost:** $0

### When to upgrade
When query time exceeds 3 seconds, or when the chunk count grows beyond ~50K
(multiple textbooks), or when deploying on a low-memory server.

### Option A — Redis Vector Search (FREE, already in stack)
Redis Stack (already running in docker-compose) supports vector similarity via
`FT.CREATE` with `VECTOR` fields. Load all embeddings into Redis once at startup
(or after ingestion), then query with `FT.SEARCH ... KNN`.

- **Cost:** $0 (Redis already running)
- **Query time:** < 50ms
- **Effort:** ~4 hours (load embeddings on startup, add Redis search query)
- **Caveat:** Redis holds embeddings in RAM — 96 MB always allocated
- **Migration:** Add a `load_embeddings_to_redis()` startup function in `main.py`

### Option B — MongoDB Atlas Vector Search
MongoDB Atlas (cloud) has a native `$vectorSearch` aggregation operator backed by
HNSW index. Requires migrating from local Docker MongoDB to Atlas cloud.

- **Cost:** Atlas M0 (free, 512 MB limit — tight). M10 paid: ~$57/month.
- **Query time:** < 10ms
- **Effort:** ~6 hours (export data, migrate to Atlas, create vector index, update URI)
- **Best for:** Production with real user traffic and multiple textbooks

### Option C — pgvector (PostgreSQL)
If you ever migrate from MongoDB to PostgreSQL, `pgvector` extension provides
excellent vector search. Not relevant for current stack.

---

## 5. LLM for RAG Answer Generation

### Current (MVP)
**OpenAI `gpt-4o-mini`** — uses the existing `OPENAI_API_KEY`. Cheap, reliable,
no extra setup.

- **Cost:** ~$0.15/1M input tokens + $0.60/1M output tokens
  - Typical RAG query: ~2K tokens in + ~500 tokens out ≈ $0.0006/query
  - 1,000 queries/month ≈ $0.60

### When to upgrade
If API costs grow as user base scales, or if you want zero ongoing cost.

### Option A — Google Gemini 2.0 Flash (FREE tier)
Get a free API key at [aistudio.google.com](https://aistudio.google.com).
Use the `google-generativeai` Python SDK. 1,500 free requests/day — more than enough
for MVP user counts.

- **Cost:** $0 up to 1,500 req/day; then $0.10/1M tokens paid
- **Quality:** Excellent — comparable to GPT-4o-mini for RAG tasks
- **Effort:** ~1 hour (swap LLM client, add `GEMINI_API_KEY` to `.env`)
- **Recommended upgrade path** when costs become a concern

### Option B — Ollama in Docker (FREE, local)
Add an Ollama service to `docker-compose.yml`:

```yaml
ollama:
  image: ollama/ollama
  ports:
    - "11434:11434"
  volumes:
    - ollama_data:/root/.ollama
```

Pull a model: `docker exec -it coreMD-ollama ollama pull llama3.1:8b`
Call it via OpenAI-compatible API at `http://localhost:11434/v1`.

- **Cost:** $0 forever
- **Quality:** Good with `llama3.1:8b` or `gemma2:9b`
- **Caveat:** Needs GPU for acceptable speed (< 5s responses). On CPU: 30–60s per query.
- **Disk:** ~5 GB per model
- **Best for:** Air-gapped/offline deployment or if you have a machine with a GPU

### Option C — Anthropic Claude API (haiku-4-5)
Requires a separate paid Anthropic API account (not the Claude Code subscription).
Claude Code CLI auth cannot be used from application code.

- **Cost:** ~$0.25/1M input + $1.25/1M output tokens (slightly more than GPT-4o-mini)
- **Quality:** Excellent, strong reasoning
- **Effort:** ~30 minutes (swap client)

---

## 6. Medical Images in PDFs

### Current (MVP)
**Skipped entirely.** Text-only RAG. Medical images (ECGs, X-rays, histology slides,
diagrams) in Harrison's PDFs are not extracted or indexed.

### When to upgrade
When residents ask about visual findings (e.g., "What does an ECG in hyperkalemia look
like?") and the AI can't answer well from text alone.

### Option A — Extract images + store on S3 + text reference in chunks
Use PyMuPDF's `page.get_images()` to extract images, upload to S3, store S3 URLs in
`text_chunks` alongside the text. Display images inline in the section viewer.

- **Cost:** S3 storage (~$0.02/GB/month)
- **Effort:** ~8 hours
- **Limitation:** Images aren't searchable — only retrieved when their surrounding text matches

### Option B — Extract images + auto-caption with vision model
Extract images with PyMuPDF, send each to GPT-4o / Gemini Vision for captioning,
store captions as additional text chunks. Captions are searchable via vector similarity.

- **Cost:** ~$0.001–0.005 per image (vision API call). Harrison's has thousands of images.
- **Effort:** ~12 hours
- **Best outcome:** "ECG in hyperkalemia" query retrieves the actual image caption + surrounding text

---

## 7. Question Bank Seeding

### Current (MVP)
**20 manually written MCQs** across 6 specialties via `seed_questions.py`.

### When to upgrade
When you need hundreds or thousands of high-quality questions without writing them by hand.

### Option A — AI-generated questions from chapter text
Use GPT-4o or Claude to read each chapter's text chunks and generate MCQs automatically.
Pass chapter text → LLM → structured JSON with stem, options, correct_option, explanation.

- **Cost:** ~$0.01–0.05 per chapter. 492 chapters ≈ $5–25 total.
- **Quality:** Good for factual content. Needs human review for clinical nuance.
- **Effort:** ~6 hours (generation script + review workflow)

### Option B — Import from external question bank
Datasets like USMLE-style question banks exist in JSON/CSV format. Map fields to the
CoreMD schema and bulk-import via a migration script.

- **Cost:** Depends on source (some are open, some licensed)
- **Effort:** ~4 hours (schema mapping + import script)

---

## 8. Case Studies Seeding

### Current (MVP)
**22 manually written cases** across 8 specialties via `seed_cases.py`.

### Option A — AI-generated cases from chapter content
Similar to question generation: feed chapter text to GPT-4o and prompt it to write a
structured clinical case in the CoreMD schema format.

- **Cost:** ~$0.02–0.10 per case. 100 cases ≈ $2–10.
- **Quality:** Clinically plausible; needs physician review before production use.

---

## 9. Chat / Conversation History

### Current (MVP) — planned for AI Assistant PRD
**Frontend-only session state** (`useState` in React). History is cleared when the user
navigates away or refreshes. No backend persistence. Conversation limited to last N
exchanges to cap context window costs.

### When to upgrade
When users want to review past conversations, or when a session longer than ~10 exchanges
is needed for complex differential diagnosis workflows.

### Option A — MongoDB conversation storage
Store each conversation as a document in a `conversations` collection with
`user_id`, `session_id`, `messages: [{role, content, timestamp}]`.
Load history on page load, append on each exchange.

- **Cost:** Negligible MongoDB storage
- **Effort:** ~4 hours (backend CRUD + frontend load on mount)

### Option B — Redis session cache (TTL-based)
Store conversation history in Redis with a TTL (e.g., 24 hours). Auto-expires.
Balances persistence with automatic cleanup.

- **Cost:** $0 (Redis already running)
- **Effort:** ~3 hours

---

## 10. Deployment

### Current (MVP)
**Local Docker Compose** — all services on one machine via `infra/docker-compose.yml`.
MongoDB and Redis on localhost. Frontend on `:5173`, backend on `:8000`.

### Production path (AWS — as specified in project spec)

| Component | AWS Service | Cost estimate |
|---|---|---|
| React frontend | S3 + CloudFront | ~$1–5/month |
| FastAPI backend | ECS Fargate or EC2 t3.small | ~$15–30/month |
| MongoDB | Atlas M10 (or self-hosted on EC2) | ~$57/month (Atlas) or ~$15/month (EC2) |
| Redis | ElastiCache t3.micro | ~$15/month |
| PDF storage | S3 | < $0.02/month |
| **Total** | | **~$90–110/month** |

### Cheaper alternative (single server)
Deploy everything on one DigitalOcean Droplet or Hetzner VPS ($6–20/month) with
Docker Compose. Works for low traffic. No managed services.

---

## 11. Frontend Chart Library

### Current (MVP)
**Recharts** — React-native, declarative, good defaults. Required `react-is` as an
explicit peer dep with `--legacy-peer-deps` due to React 19 compatibility.

### Alternatives if Recharts causes issues
- **Nivo** — more chart types, better animations, heavier bundle
- **Chart.js + react-chartjs-2** — most popular overall, imperative API
- **Tremor** — pre-built analytics components, Tailwind-based, very fast to implement

---

## Decision Log Summary

| Decision | MVP Choice | Primary Upgrade Path |
|---|---|---|
| PDF storage | Local filesystem | AWS S3 |
| TOC extraction | Full book PDF bookmarks | Manual JSON map (fallback) |
| Embeddings | OpenAI text-embedding-3-small | Google text-embedding-004 (free) |
| Vector search | Python cosine similarity | Redis Vector Search → Atlas |
| RAG LLM | OpenAI GPT-4o-mini | Gemini 2.0 Flash (free tier) |
| Medical images | Not implemented | Extract + S3 + vision captioning |
| Question seeding | 20 manual MCQs | AI-generated from chapter text |
| Case seeding | 22 manual cases | AI-generated from chapter text |
| Chat history | Frontend session only | Redis TTL cache → MongoDB |
| Deployment | Local Docker Compose | AWS (ECS + Atlas + CloudFront) |
| Charts | Recharts | Tremor (if more components needed) |

---

## 12. Deferred Features

These features were evaluated during the MVP build and intentionally excluded. They are good candidates for a future iteration once the core platform is stable with real users.

### Global Search
Full-text search across chapters, questions, and cases from a single search bar. Requires a dedicated search index (MongoDB Atlas Search or Elasticsearch). Current per-page search (chapter sidebar, question filters) is sufficient for MVP.

- **Effort:** ~2 days (index setup + unified search API + frontend search UI)
- **Trigger:** When users report difficulty finding specific content across content types

### Progress History & Trends
Time-series charts of accuracy, questions answered per day, and topic mastery over time (GitHub-style heatmap). Requires persisting daily aggregate snapshots or running aggregation queries over `question_attempts` with date bucketing.

- **Effort:** ~1 day (aggregation pipeline + chart components)
- **Trigger:** When retention metrics show users want to track improvement over time

### Password Reset
Email-based password reset flow: "Forgot password" → email with time-limited token → reset form. Requires an email sending service (SendGrid, SES, or Resend).

- **Effort:** ~4 hours (token model + email service + reset endpoints + frontend form)
- **Trigger:** When real users (not just internal testers) register and need account recovery

### Admin / Content Management UI
A protected admin panel for managing questions, cases, and chapters without direct database access. Includes add/edit/delete UI for MCQs and cases, bulk-import from JSON/CSV, and a content moderation queue.

- **Effort:** ~3 days (admin role gate + CRUD pages per content type)
- **Trigger:** When a content editor or attending physician needs to update questions without developer involvement

### Spaced Repetition System (SRS)
Algorithmically schedule question reviews using SM-2 or FSRS algorithm — questions due today are surfaced first; correct answers push the next review date further out. Requires per-question review state per user (next_review_date, interval, ease_factor).

- **Effort:** ~2 days (SRS state model + scheduling endpoint + "Review Due" session mode in Question Bank)
- **Trigger:** When residents want active recall practice, not just random sessions
