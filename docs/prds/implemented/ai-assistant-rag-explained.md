# AI Assistant (RAG) — Implementation Explained

## 1. What Was Implemented and Why

CoreMD's AI Assistant lets residents ask clinical questions and receive answers grounded in Harrison's Principles of Internal Medicine, with clickable citations linking back to the relevant chapters.

The data layer (15,673 text chunks with 1536-dimension embeddings) already existed in MongoDB from the PDF ingestion pipeline. This feature builds the retrieval and generation layer on top of that data, plus a full multi-turn chat UI.

**All five user stories are complete:**

| Story | Scope | Status |
|---|---|---|
| US-001 | `rag_service.py` — cosine similarity retrieval + context prompt builder | Done |
| US-002 | `POST /ai/ask` — RAG pipeline, Redis caching, citations | Done |
| US-003 | `frontend/src/api/aiApi.ts` — typed API client | Done |
| US-004 | `ChatPage.tsx` — multi-turn chat UI with bubbles and input bar | Done |
| US-005 | Citation chips, session limit (10 exchanges), reset button | Done |

---

## 2. Key Design Decisions

### Cosine similarity via full in-memory scan (MVP)

`get_relevant_chunks` loads all 15,673 chunk embeddings from MongoDB on every query, converts them to a NumPy matrix, and computes cosine similarity in one vectorised operation. No vector database, no extra infrastructure.

The trade-off is ~96 MB loaded and ~1–2 seconds of compute per query. The PRD documents upgrade paths (Redis or Atlas Vector Search) in `docs/architecture-options.md` — the current approach keeps the dependency surface small and the logic readable.

### Pre-normalised dot product for similarity

Both the query vector and all chunk vectors are normalised once, then similarity is computed with a single matrix–vector multiply (`embeddings_norm @ q_norm`). This is numerically equivalent to cosine similarity and faster because NumPy dispatches to BLAS routines. The `+ 1e-10` epsilon prevents division-by-zero on zero vectors.

```python
q_norm = q_vec / (np.linalg.norm(q_vec) + 1e-10)
embeddings_norm = embeddings / (norms + 1e-10)
similarities = embeddings_norm @ q_norm   # shape: (N,)
top_indices = np.argsort(similarities)[::-1][:top_k]
```

### Single `$in` query for chapter titles

After selecting the top-k chunks, the service collects unique `chapter_id` values and fires one `db.chapters.find({"chapter_id": {"$in": [...]}})` query rather than N individual lookups. This keeps `get_relevant_chunks` at exactly 2 MongoDB round-trips regardless of `top_k`.

### Chapter title resolved at call time, not stored in `text_chunks`

`text_chunks` documents store `chapter_id` but not `chapter_title`. The human-readable title is joined from `chapters` on each call. If a chapter title is ever corrected, the RAG service picks it up automatically — no re-ingestion needed.

### Numbered context block format

`build_context_prompt` produces a numbered format that lets the system prompt tell the LLM to cite by number, making attribution legible in the answer text:

```
Context from Harrison Principles of Internal Medicine:

[1] Chapter: {chapter_title} | Section: {section_title}
{chunk_text}

[2] ...
```

### Redis cache — bypass when history is non-empty

Answers to standalone questions (empty history) are cached in Redis for 1 hour using `ai_answer:{sha256(question)}` as the key. When a history is present the question is mid-conversation and context-dependent, so caching is skipped to avoid returning a stale answer. The check is simply `use_cache = len(body.history) == 0`.

### Pydantic v2 serialisation for Redis

Pydantic v2 removed `.dict()`. To store a response in Redis, the model is serialised with `json.dumps(result.model_dump())` and deserialised with `AskResponse(**json.loads(cached))`. Using `.dict()` here would raise an `AttributeError` at runtime.

### Deduplication by `chapter_id` only

The top-5 chunks may come from multiple sections of the same chapter. Citations are deduplicated by `chapter_id` alone (not by `(chapter_id, section_title)`) so the citations list contains at most one entry per chapter. This keeps the UI uncluttered and avoids showing the same chapter linked twice.

### Session-only conversation history

Conversation history is stored in React `useState` — it is never persisted to the database. Clearing the page or navigating away resets the conversation. This is a deliberate non-goal in the PRD: no DB writes, no user-specific conversation logs.

### React Router `<Link>` for citation chips

Citation chips use React Router's `<Link to={/chapters/${chapter_id}}>` rather than a plain `<a href>`. This keeps navigation in-app (no full page reload) and preserves the SPA routing behaviour consistent with the rest of the frontend.

### Session limit: 10 exchanges (20 messages)

Once the completed message list reaches 20 entries (10 user + 10 assistant), the input is disabled and a banner appears. The "Start new conversation" button clears state and re-enables input. The limit is enforced client-side; there is no server-side session cap.

---

## 3. MongoDB Collections Read (Not Written)

`rag_service.py` is read-only — no documents are created or modified. It reads from two existing collections.

### `text_chunks` collection (read)

All 15,673 documents are fetched on each call. Fields used (projection excludes `_id`):

```json
{
  "chunk_id":      "p06_c238_chunk_042",
  "chapter_id":    "p06_c238",
  "section_title": "Pathophysiology of Heart Failure",
  "text":          "Heart failure (HF) occurs when...",
  "embedding":     [0.0021, -0.0147, ..., 0.0083]
}
```

`embedding` is a 1536-element float array produced by `text-embedding-3-small`.

### `chapters` collection (read)

Only the unique `chapter_id` values from the top-k results are queried. Fields used:

```json
{
  "chapter_id": "p06_c238",
  "title":      "Heart Failure and Cor Pulmonale"
}
```

### Return value of `get_relevant_chunks`

A plain Python list of dicts (not a Pydantic model — serialisation is handled by the calling endpoint):

```python
[
  {
    "chunk_id":      "p06_c238_chunk_042",
    "chapter_id":    "p06_c238",
    "chapter_title": "Heart Failure and Cor Pulmonale",
    "section_title": "Pathophysiology of Heart Failure",
    "text":          "Heart failure (HF) occurs when...",
  },
  # ... up to top_k entries
]
```

---

## 4. How to Run

### Prerequisites

```bash
# Backend deps (numpy is listed here)
cd backend
pip install -r requirements.txt
```

`backend/.env` must have `OPENAI_API_KEY` set. All other variables (Mongo, Redis, JWT) must also be present — see CLAUDE.md for the full list.

### Backend dev server

```bash
cd backend
python -m uvicorn app.main:app --reload   # http://localhost:8000
```

The `POST /ai/ask` endpoint requires a valid JWT. Log in first to obtain a token.

### Frontend dev server

```bash
cd frontend
npm run dev   # http://localhost:5173
```

Navigate to `/chat` (linked from the Home page) to use the AI Assistant.

### Docker (full stack)

```bash
cd infra
docker-compose up   # backend :8000, frontend :5173, MongoDB :27017, Redis :6379
```

### Calling the endpoint directly

```bash
curl -X POST http://localhost:8000/ai/ask \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What are the common causes of heart failure?",
    "history": []
  }'
```

Response shape:

```json
{
  "answer": "According to Harrison's...",
  "citations": [
    {
      "chapter_id": "p06_c238",
      "chapter_title": "Heart Failure and Cor Pulmonale",
      "section_title": "Pathophysiology of Heart Failure"
    }
  ]
}
```

---

## 5. Files Changed

| File | Action | What it does |
|---|---|---|
| `backend/app/services/rag_service.py` | Created | `get_relevant_chunks(db, question_embedding, top_k=5)`: loads all `text_chunks` embeddings, computes cosine similarity via NumPy, joins chapter titles from `chapters`, returns top-k dicts. `build_context_prompt(chunks)`: formats chunks into a numbered context block string for the LLM system prompt. |
| `backend/app/schemas/ai.py` | Created | Pydantic v2 models for the AI endpoint: `HistoryMessage`, `AskRequest` (question + optional history list), `Citation` (chapter_id, chapter_title, section_title), `AskResponse` (answer + citations list). |
| `backend/app/api/v1/routes/ai.py` | Modified | Replaced the previous `GET /ai/ask` stub with `POST /ai/ask`. Implements the full RAG pipeline: embed question → retrieve chunks → build prompt → call gpt-4o-mini → deduplicate citations → cache result in Redis → return `AskResponse`. Requires valid JWT. |
| `backend/requirements.txt` | Modified | Added `numpy` — required for vectorised cosine similarity. |
| `frontend/src/api/aiApi.ts` | Created | TypeScript types (`Message`, `Citation`, `AskResponse`) and `askQuestion(question, history)` function that calls `POST /ai/ask` via the existing `apiClient` Axios instance. |
| `frontend/src/pages/ChatPage.tsx` | Created | Full chat UI: scrollable message thread with user (blue, right-aligned) and assistant (grey, left-aligned) bubbles; citation chips as `<Link>` components below each assistant message; input bar with Enter-to-submit; loading `"..."` placeholder bubble; session limit banner at 10 exchanges with "Start new conversation" reset button. |
| `frontend/src/router.tsx` | Modified | Added the protected `/chat` route pointing to `ChatPage`. |
| `frontend/src/pages/Home.tsx` | Modified | Added a "Chat" navigation link to the Home page so residents can reach the AI Assistant. |

---

## 6. Key Learnings

**Pydantic v2 Redis serialisation (US-002)**

Pydantic v2 removed the `.dict()` method. Storing a model in Redis requires:

```python
redis.setex(cache_key, 3600, json.dumps(result.model_dump()))
```

Reading it back:

```python
AskResponse(**json.loads(cached))
```

Using `.dict()` raises `AttributeError` at runtime under Pydantic v2. The cache bypass condition (`len(body.history) == 0`) must be evaluated before hitting Redis, not after — otherwise a mid-conversation question with matching text could incorrectly return a cached standalone answer.

**Citation deduplication scope (US-005)**

Deduplicating citations by `(chapter_id, section_title)` is too granular — the same chapter can appear twice under different section titles, cluttering the UI. Deduplicating by `chapter_id` only produces a clean one-chip-per-chapter result, which is what users care about when navigating to source material.

**React Router `<Link>` for citation chips (US-005)**

Using a plain `<a href="/chapters/...">` for citation chips causes a full page reload, clearing the conversation state. React Router's `<Link to="...">` performs client-side navigation, keeping the session history intact if the user navigates back. This is the correct component for in-app links throughout the frontend.
