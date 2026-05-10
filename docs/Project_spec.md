# Intelligent Harrison’s Study & Question Bank Platform

## 1. Overview

A web platform for internal medicine residents (3rd year and up) to:

- Study content extracted from **Harrison’s Principles of Internal Medicine (21st ed.)**
- Practice with a **question bank** and **case studies**
- Ask questions to an **AI assistant** (RAG, not free-form hallucinations)

The application will:

- Use preprocessed data from the Harrison’s PDF (chapters, sections, chunks).
- Provide a rich React-based UI.
- Use FastAPI as the backend.
- Store data in MongoDB and cache in Redis.
- Integrate with an LLM via retrieval-augmented generation (RAG).
- Run in Docker containers and be deployable to AWS.

---

## 2. Tech Stack

### 2.1 Frontend

- **React** (TypeScript)
- **React Router**
- **TailwindCSS** for styling
- API communication via `fetch` or `axios`

**Responsibilities:**

- Authentication UI (login/register, token handling)
- Dashboard with learning progress
- Chapter explorer & reader
- Question bank UI (MCQs, explanations, stats)
- Case study viewer
- AI assistant chat window with references

---

### 2.2 Backend

- **Python** + **FastAPI**
- **Pydantic** for request/response models
- **Uvicorn/Gunicorn** as ASGI server
- JWT-based authentication

**Responsibilities:**

- Expose REST APIs for:
  - Auth (`/auth/*`)
  - Chapters (`/chapters/*`)
  - Questions (`/questions/*`)
  - Case studies (`/cases/*`)
  - AI Q&A (`/ai/ask`)
- Coordinate with MongoDB, Redis, and the LLM provider
- Implement the RAG pipeline

---

### 2.3 Databases

#### MongoDB

Primary data store for:

- `users`
- `chapters`
- `questions`
- `cases`
- `text_chunks` (for RAG)


Example collections:

- `chapters`:
  - `chapter_id`, `title`, `sections`, `specialty`, `order`
- `text_chunks`:
  - `chunk_id`, `chapter_id`, `section`, `text`, `embedding_vector` (or ref), `tokens_count`
- `questions`:
  - `question_id`, `stem`, `options`, `correct_option`, `explanation`, `topic`, `chapter_ref`, `difficulty`
- `cases`:
  - `case_id`, `title`, `presentation`, `history`, `labs`, `imaging`, `discussion`, `diagnosis`, `management`, `chapter_ref`
- `users`:
  - `user_id`, `email`, `hashed_password`, `role`


#### Redis

Used for:

- Caching frequently requested chapters/questions
- Caching AI responses (query + context hash → answer)
- Optionally: rate limiting and session-like data
- Optionally: vector search (if using Redis Stack) for embeddings

Key patterns:

- `chapter:{chapter_id}`
- `questions:topic:{topic}`
- `ai_answer:{hash_of_query_and_context}`

---

### 2.4 AI Integration (RAG)

We will **not** feed the raw PDF each time. Instead:

1. **Offline ingestion & preprocessing pipeline:**
   - Extract and clean text from the PDF.
   - Parse chapters, sections, headings.
   - Chunk text into semantically meaningful segments (e.g. 500–1000 tokens with overlap).
   - Generate embeddings for each chunk.
   - Store chunks + metadata + embeddings in MongoDB / Redis vector store.

2. **At query time (`/ai/ask` endpoint):**
   - Receive user question.
   - Generate embedding for question.
   - Retrieve top-k similar chunks from the vector store.
   - Construct a prompt:
     - System instructions (medical assistant, grounded, no hallucinations)
     - Retrieved chunks as context
     - User question
   - Call LLM chat/completion API.
   - Return answer + references mapped back to chapters/sections.

---

### 2.5 Containerization

We will use **Docker** for all services.

Services (dev, via `docker-compose`):

- `backend` (FastAPI)
- `frontend` (React dev server or built + served via nginx)
- `mongo`
- `redis`
- (optional) `worker` for ingestion scripts / background tasks

Each will have a `Dockerfile` and share environment via `docker-compose.yml`.

---

### 2.6 AWS Deployment (Later Phase)

Target (can evolve):

- **Frontend**:
  - Deployed as static files to **S3** + **CloudFront**
- **Backend**:
  - Run via **ECS** (Fargate) or **EC2**
- **MongoDB**:
  - Either:
    - Self-hosted in ECS/EC2
    - Or managed equivalent (e.g., Mongo Atlas, AWS DocumentDB)
- **Redis**:
  - Prefer **Amazon ElastiCache** in production
- **Secrets**:
  - Stored in **AWS Systems Manager** (SSM) or **Secrets Manager**

---

## 3. Architecture Overview

### 3.1 High-Level Flow

1. User navigates to web app (React).
2. Frontend calls backend for:
   - Auth (`/auth/login`, `/auth/register`)
   - Content (`/chapters`, `/questions`, `/cases`)
   - AI Q&A (`/ai/ask`)
3. Backend:
   - Authenticates requests and verifies JWTs.
   - Reads/writes data from MongoDB.
   - Uses Redis for caching.
   - For `/ai/ask`, runs the RAG pipeline with the LLM.
4. Response is returned to frontend and rendered in UI.

---

## 4. Features & Scope (MVP)

### 4.1 MVP Features

- [ ] User registration and login (JWT-based)
- [ ] Chapter explorer
  - [ ] List chapters and sections
  - [ ] View chapter/section content
- [ ] Question bank
  - [ ] Filter questions by topic/chapter
  - [ ] Answer questions (MCQs)
  - [ ] View correct answer and explanation
- [ ] Basic case study list & viewer
- [ ] AI Q&A
  - [ ] Ask question
  - [ ] Get answer grounded in book data
  - [ ] Show references to chapters/sections
- [ ] User progress tracking (basic stats)

### 4.2 Future Enhancements (Beyond MVP)

- [ ] Adaptive learning: recommend topics based on performance
- [ ] More sophisticated analytics for residents
- [ ] Richer case simulations (multi-step decision trees)
- [ ] Role-based features (e.g. “mentor”/“admin” mode)
- [ ] Offline/low-bandwidth modes (caching on client)

---

## 5. Development Phases & Checklists

### Phase 1 — Repo & Environment Setup

**Goal:** Multi-service dev environment up and running.

- [ ] Initialize repo structure:
  - [ ] `/backend`
  - [ ] `/frontend`
  - [ ] `/infra`
- [ ] Create backend base:
  - [ ] `FastAPI` app skeleton (`main.py`)
  - [ ] Base routes (`/health`)
- [ ] Create frontend base:
  - [ ] React + TypeScript scaffold (e.g. Vite)
  - [ ] Simple landing page
- [ ] Create `docker-compose.yml`:
  - [ ] Backend service
  - [ ] Frontend service
  - [ ] MongoDB service
  - [ ] Redis service
- [ ] Define `.env.development` example file

---

### Phase 2 — Backend Core: Auth, DB Integration, Basic Models

**Goal:** Have a functioning API with auth and core models.

- [ ] Configure MongoDB client (backend/app/db/mongo.py)
- [ ] Configure Redis client (backend/app/db/redis.py)
- [ ] Implement core models (Mongo level):
  - [ ] User
  - [ ] Chapter
  - [ ] Question
  - [ ] Case
  - [ ] TextChunk
- [ ] Implement Pydantic schemas:
  - [ ] Auth (login, register, tokens)
  - [ ] User
  - [ ] Chapter / Section
  - [ ] Question
  - [ ] Case
- [ ] Implement JWT-based auth:
  - [ ] Password hashing
  - [ ] Access token creation & verification
  - [ ] Auth routes (`/auth/register`, `/auth/login`, `/auth/me`)
- [ ] Implement basic routes:
  - [ ] `/chapters` (list, get by ID)
  - [ ] `/questions` (list by topic)
  - [ ] `/cases` (list, get by ID)

---

### Phase 3 — Frontend Core: Auth + Navigation + Basic Pages

**Goal:** User can log in and navigate main app sections.

- [ ] Setup routing:
  - [ ] Login
  - [ ] Register
  - [ ] Dashboard
  - [ ] Chapters
  - [ ] Questions
  - [ ] Cases
  - [ ] Chat
- [ ] Implement auth context:
  - [ ] Store JWT
  - [ ] Refresh logic (if implemented)
  - [ ] Protected routes
- [ ] Implement basic layout:
  - [ ] Navbar
  - [ ] Sidebar
- [ ] Implement pages:
  - [ ] Login page (calls `/auth/login`)
  - [ ] Dashboard (static for now)
  - [ ] Chapters page (fetch list from `/chapters`)
  - [ ] Questions page (fetch list from `/questions`)
  - [ ] Cases page (fetch list from `/cases`)

---

### Phase 4 — PDF Ingestion & Data Population (Offline Scripts)

**Goal:** Harrison’s data in MongoDB + embeddings ready.

- [ ] Implement `pdf_parser.py`:
  - [ ] Open PDF
  - [ ] Extract clean text with chapter/section boundaries
- [ ] Implement `chunking.py`:
  - [ ] Split text into manageable chunks
  - [ ] Keep mapping to chapter/section
- [ ] Implement `ingest_harrison_pdf.py`:
  - [ ] Create chapter documents
  - [ ] Create text chunk documents
- [ ] Implement `generate_embeddings.py`:
  - [ ] Generate embeddings for each chunk
  - [ ] Store embedding vectors in MongoDB/Redis vector store
- [ ] Seed questions:
  - [ ] Script `seed_questions.py` to insert initial question bank

---

### Phase 5 — AI Integration: RAG Endpoint & Chat UI

**Goal:** AI answers grounded in Harrison’s content.

- [ ] Backend AI service (`ai_service.py`):
  - [ ] Function to embed queries
  - [ ] Function to retrieve top-k similar chunks
  - [ ] Function to construct prompt with context
  - [ ] Call LLM API and parse response
- [ ] `/ai/ask` route:
  - [ ] Input: user question
  - [ ] Output: answer text + references
- [ ] Add caching:
  - [ ] Cache answers in Redis by (user_id, question, context hash)
- [ ] Frontend:
  - [ ] `ChatWindow` component
  - [ ] Message list with roles (user/assistant)
  - [ ] Input box and submit
  - [ ] Display answer + list of references (chapter/section names)

---


### Phase 6 — Hardening, QA, and AWS Deployment

**Goal:** Make the app production-ready and deploy.

- [ ] Backend:
  - [ ] Input validation, error responses
  - [ ] Logging and structured logs
  - [ ] Healthcheck endpoint for load balancers
- [ ] Frontend:
  - [ ] Handle loading and error states gracefully
  - [ ] UX polish for forms and navigation
- [ ] Docker:
  - [ ] Production-ready Dockerfiles (smaller images, multi-stage builds)
- [ ] AWS:
  - [ ] Create infrastructure definition (ECS/EKS + S3 + CloudFront)
  - [ ] Deploy backend
  - [ ] Deploy frontend
  - [ ] Configure domain and HTTPS

---

## 6. Non-Functional Requirements

- **Security**
  - JWT auth
  - HTTPS in production
  - Secrets in env vars / AWS secrets store
- **Performance**
  - Caching for hot endpoints (chapters, common questions)
  - Vector search that scales
- **Reliability**
  - Health checks and logs
  - Avoid single points of failure where possible
- **Maintainability**
  - Clear folder structure
  - Separation of concerns (routes, services, db, utils)
  - Basic tests for critical paths (auth, AI endpoint)

---

## 7. Open Questions / TODOs

- [ ] Which exact LLM and embedding model will be used (OpenAI model names, etc.)?
- [ ] Where to host the vector index (Mongo vs Redis vs separate vector DB)?
- [ ] Exact chunk size and overlap for the RAG pipeline?
- [ ] Precise UX for references (show chapter + page? section? both?)
- [ ] Plan for updating content if a new edition of Harrison’s appears?

