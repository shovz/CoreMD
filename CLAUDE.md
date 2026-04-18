# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CoreMD is a full-stack medical learning platform for internal medicine residents, built around Harrison's Principles of Internal Medicine (21st Edition). It features a chapter/section explorer, MCQ question bank, case studies, and a RAG-based AI assistant grounded in Harrison's content.

## Commands

### Backend

```bash
cd backend
python -m uvicorn app.main:app --reload   # Dev server on :8000
```

### Frontend

```bash
cd frontend
npm run dev      # Vite dev server on :5173
npm run build    # TypeScript check + bundle
npm run lint     # ESLint
```

### Docker (full stack)

```bash
cd infra
docker-compose up   # Starts backend :8000, frontend :5173, MongoDB :27017, Redis :6379
```

## Architecture

**Stack:** FastAPI (Python) + React 19 (TypeScript) + MongoDB + Redis

### Backend (`backend/app/`)

- **`main.py`** — FastAPI app, CORS config, router registration
- **`api/v1/routes/`** — Route modules: `auth`, `chapters`, `questions`, `cases`, `ai`, `stats`, `debug`
- **`api/deps/auth.py`** — `get_current_user` dependency (validates JWT, loads user from MongoDB)
- **`services/`** — Business logic layer: `auth_service`, `progress_service`, `question_attempt_service`, `stats_service`
- **`schemas/`** — Pydantic request/response models
- **`models/`** — Internal domain models: `user`, `user_progress`, `question_attempt`
- **`core/`** — Config (Pydantic Settings from `.env`), JWT utilities, password hashing
- **`db/`** — MongoDB (`mongo.py`) and Redis (`redis.py`) client setup + FastAPI deps

**Auth flow:** JWT tokens issued at login, stored in browser localStorage, sent as `Authorization: Bearer <token>` on protected routes. The `get_current_user` dependency decodes the JWT, extracts the user `_id`, and loads the user document from MongoDB.

**Caching:** Redis caches hot data with key patterns `chapter:{id}`, `questions:topic:{topic}`, `ai_answer:{hash}`.

### Frontend (`frontend/src/`)

- **`router.tsx`** — React Router 7 routes; protected routes wrapped in auth guard
- **`pages/`** — Page components: `Home`, `LoginPage`, `RegisterPage`, `DashboardPage`, `ChaptersPage`, `ChapterDetailPage`, `SectionDetailPage`
- **`api/`** — Axios-based API clients: `apiClient.ts` (base instance with auth header injection), `authApi.ts`, `chaptersApi.ts`, `sectionApi.ts`

### Environment Variables

Required in `backend/.env`:

```
MONGO_URI=mongodb://localhost:27017/CoreMD
REDIS_URL=redis://localhost:6379
JWT_SECRET=changeme
JWT_ALGORITHM=HS256
OPENAI_API_KEY=your_key_here   # for AI/RAG routes
```
