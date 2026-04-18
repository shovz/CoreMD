# PRD: AI Assistant (RAG)

## Introduction

The AI Assistant is CoreMD's most powerful learning feature — a chat interface grounded
entirely in Harrison's Principles of Internal Medicine. Residents can ask clinical questions
and get answers backed by the exact text chunks from the book, with citations linking to
the relevant chapters.

The 15,673 text chunks with 1536-dimension embeddings are already in MongoDB from the
ingestion pipeline. This PRD builds the retrieval and generation layer on top of that data
and the full multi-turn chat UI.

## How It Works (RAG Pipeline)

1. User asks a clinical question
2. Backend generates an embedding for the question (OpenAI text-embedding-3-small)
3. Loads all chunk embeddings from MongoDB, computes cosine similarity in Python (numpy)
4. Selects top 5 most relevant chunks across Harrison chapters
5. Builds a prompt: system instructions + 5 context chunks + conversation history + question
6. Calls OpenAI GPT-4o-mini — answer is grounded in the retrieved text only
7. Returns answer + citations (chapter_id, chapter_title, section_title)
8. Answer cached in Redis by question hash (1 hour TTL)

## Goals

- RAG service: cosine similarity retrieval over 15,673 embedded chunks, top 5 results
- AI endpoint: multi-turn conversation support with grounded answers and citations
- Chat UI: multi-turn conversation, session-only history, max 10 exchanges then prompt to reset
- Citations rendered as clickable links to the existing chapter detail page

## User Stories

### US-001: RAG retrieval service
**Description:** As a developer, I need a service that finds the most relevant Harrison
chunks for a given query so the LLM has grounded context to answer from.

**Acceptance Criteria:**
- [x] `backend/app/services/rag_service.py` created
- [x] `get_relevant_chunks(db, question_embedding, top_k=5) -> list[dict]` loads all chunk embeddings from `text_chunks` collection and returns top-k by cosine similarity
- [x] Cosine similarity computed with `numpy` (dot product of normalised vectors)
- [x] Each returned dict contains: `chunk_id`, `chapter_id`, `chapter_title` (looked up from `chapters`), `section_title`, `text`
- [x] `build_context_prompt(chunks) -> str` formats the chunks into a numbered context block for the LLM prompt
- [x] `numpy` added to `backend/requirements.txt`
- [x] Typecheck passes

### US-002: AI ask endpoint
**Description:** As a developer, I need a POST endpoint that accepts a question and
conversation history, runs the RAG pipeline, and returns an answer with citations.

**Acceptance Criteria:**
- [x] `POST /ai/ask` replaces the existing stub in `backend/app/api/v1/routes/ai.py`
- [x] Request body: `{"question": str, "history": [{"role": "user" or "assistant", "content": str}]}` — history optional, defaults to empty list
- [x] Response body: `{"answer": str, "citations": [{"chapter_id": str, "chapter_title": str, "section_title": str}]}`
- [x] Pipeline: generate question embedding, retrieve top 5 chunks, build prompt with system message + context + last 10 history messages + question, call gpt-4o-mini, return answer + deduplicated citations
- [x] System prompt instructs LLM to answer only from provided context and say "I do not have enough information" if context is insufficient
- [x] Answer cached in Redis with key `ai_answer:{sha256(question)}` TTL 3600s — cache bypassed when history is non-empty
- [x] `backend/app/schemas/ai.py` created with `AskRequest`, `Citation`, `AskResponse` Pydantic models
- [x] Requires valid JWT
- [x] Typecheck passes

### US-003: Chat API client and types
**Description:** As a developer, I need a typed frontend API client for the AI endpoint
so the chat UI can make requests cleanly.

**Acceptance Criteria:**
- [x] `frontend/src/api/aiApi.ts` created
- [x] TypeScript types: `Message {role: "user"|"assistant", content: string}`, `Citation {chapter_id: string, chapter_title: string, section_title: string}`, `AskResponse {answer: string, citations: Citation[]}`
- [x] `askQuestion(question: string, history: Message[]) -> Promise<AskResponse>` calls `POST /ai/ask` via existing `apiClient`
- [x] Typecheck passes

### US-004: Chat UI
**Description:** As a resident, I want a multi-turn chat interface where I can ask
clinical questions and get grounded answers from Harrison.

**Acceptance Criteria:**
- [x] `frontend/src/pages/ChatPage.tsx` created
- [x] Route `/chat` added to `frontend/src/router.tsx`
- [x] Chat link added to `Home.tsx` navigation
- [x] Message thread displayed as chat bubbles: user messages right-aligned (blue), assistant messages left-aligned (grey)
- [x] Each assistant message shows its citations below the answer text
- [x] Input bar at bottom: text input + Ask button, disabled while waiting for response
- [x] Pressing Enter submits the question
- [x] Loading state: assistant bubble shows "..." while waiting
- [x] Conversation history stored in `useState` (session only, cleared on refresh/navigation)
- [x] Typecheck passes
- [x] Verify changes work in browser

### US-005: Citations display and session limit
**Description:** As a resident, I want to see which Harrison chapters the answer came
from, and be prompted to start fresh when the conversation gets long.

**Acceptance Criteria:**
- [x] Each assistant message shows citation chips below the answer text
- [x] Each chip displays chapter title truncated to 40 chars
- [x] Each chip is a clickable link to `/chapters/{chapter_id}` (existing chapter detail page)
- [x] When conversation reaches 10 exchanges (20 messages), input is disabled and a banner appears: "Conversation limit reached"
- [x] "Start new conversation" button clears message history and re-enables input
- [x] Typecheck passes
- [x] Verify changes work in browser

## Non-Goals

- No conversation persistence to database (session only)
- No streaming responses (full answer returned at once)
- No image-based queries (text only)
- No feedback or thumbs up/down on answers
- No admin view of conversation logs
- No switching between LLM providers in the UI

## Technical Considerations

- `get_relevant_chunks` loads ALL embeddings from MongoDB on each query (~96 MB, ~1-2s). MVP approach. See `docs/architecture-options.md` section 4 for Redis/Atlas upgrade paths.
- Chapter titles for citations: do a single MongoDB `$in` query for all unique chapter_ids in the top-5 results.
- Deduplication: top-5 chunks may come from the same chapter. `citations` list must be unique by `chapter_id`.
- GPT-4o-mini context: 128K tokens. Our prompt (~5 chunks x 800 tokens + history + question) is ~6K tokens, well within limits.
- The existing `ai.py` route is `GET /ai/ask` — must change to `POST` when replacing the stub.
- Redis cache key: `ai_answer:{hashlib.sha256(question.encode()).hexdigest()}`. Skip cache when history is non-empty.

### System Prompt Template

```
You are a clinical medical assistant for internal medicine residents.
Answer questions using ONLY the provided Harrison textbook excerpts below.
If the context does not contain enough information to answer, say so clearly.
Always reference which chapter or section your answer is based on.

Context from Harrison Principles of Internal Medicine:
[1] Chapter: {chapter_title} | Section: {section_title}
{chunk_text}

[2] ...up to 5 chunks...
```

### Files to Create / Modify

| File | Action |
|---|---|
| `backend/app/services/rag_service.py` | Create |
| `backend/app/schemas/ai.py` | Create |
| `backend/app/api/v1/routes/ai.py` | Replace GET stub with POST |
| `backend/requirements.txt` | Add numpy |
| `frontend/src/api/aiApi.ts` | Create |
| `frontend/src/pages/ChatPage.tsx` | Create |
| `frontend/src/router.tsx` | Add /chat route |
| `frontend/src/pages/Home.tsx` | Add Chat link |
