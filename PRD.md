# PRD: Docker Setup

## Introduction

CoreMD has no Dockerfiles. The `docker-compose.yml` references `build: ../backend`
and `build: ../frontend` but both directories lack a Dockerfile, so
`docker-compose up` fails immediately. This PRD adds everything needed to run the
full stack (backend, frontend, MongoDB, Redis) with a single command.

This is also the foundation for AWS deployment — ECS just runs the same images.

## Goals

- `docker-compose up` from `infra/` starts all 4 services successfully
- Backend reachable at `http://localhost:8000`
- Frontend reachable at `http://localhost:5173` (nginx serving built React app)
- Frontend API URL configurable via `VITE_API_URL` env var (defaults to localhost:8000)
- No secrets committed — env file excluded from git

## How It Works

1. `backend/Dockerfile` — python:3.11-slim, installs requirements, runs uvicorn
2. `frontend/Dockerfile` — two-stage: Node 20 builds the React app, nginx serves dist/
3. `frontend/nginx.conf` — SPA fallback: all paths → index.html (required for React Router)
4. `infra/env/.env.development` — MongoDB/Redis URIs using Docker service names (mongo, redis)
5. `docker-compose.yml` updated — correct ports, build args, healthchecks
6. `apiClient.ts` reads `VITE_API_URL` env var so it works in both local and production

## User Stories

### US-001: Backend Dockerfile
**Description:** As a developer, I need a Dockerfile for the FastAPI backend so it
can be built and run as a container.

**Acceptance Criteria:**
- [x] `backend/Dockerfile` created using `python:3.11-slim` base image
- [x] Copies `requirements.txt`, runs `pip install --no-cache-dir -r requirements.txt`
- [x] Copies `app/` and `scripts/` directories
- [x] CMD: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- [x] `backend/.dockerignore` created (excludes `.env`, `__pycache__`, `*.pyc`, `.venv`)
- [x] Image builds without error: `docker build -t coremd-backend ./backend`
- [x] Typecheck passes

### US-002: Frontend Dockerfile and nginx config
**Description:** As a developer, I need a multi-stage Dockerfile for the React
frontend so it builds the app and serves it via nginx.

**Acceptance Criteria:**
- [x] `frontend/Dockerfile` created with two stages:
  - Stage 1 (`build`): `node:20-alpine`, copies package files, runs `npm ci`, copies src, runs `npm run build`
  - Stage 2 (`serve`): `nginx:alpine`, copies `dist/` from build stage, copies nginx config
- [x] `frontend/nginx.conf` created — listens on port 80, `try_files $uri $uri/ /index.html` for SPA routing
- [x] `frontend/.dockerignore` created (excludes `node_modules`, `dist`, `.env*`)
- [x] Image builds without error: `docker build -t coremd-frontend ./frontend`

### US-003: Environment config and docker-compose update
**Description:** As a developer, I need environment files and an updated
docker-compose so all services connect correctly inside Docker networking.

**Acceptance Criteria:**
- [ ] `infra/env/` directory created
- [ ] `infra/env/.env.development` created with:
  - `MONGO_URI=mongodb://mongo:27017/CoreMD` (Docker service name, not localhost)
  - `REDIS_URL=redis://redis:6379`
  - `JWT_SECRET=dev-secret-change-in-production`
  - `JWT_ALGORITHM=HS256`
  - `OPENAI_API_KEY=` (empty placeholder — user fills in)
- [ ] `infra/env/.env.development.example` created as a copy without secret values (committed to git)
- [ ] `infra/.gitignore` created to exclude `env/.env.development` (not the example)
- [ ] `infra/docker-compose.yml` updated:
  - frontend: `ports: ["5173:80"]` (nginx on 80 inside, 5173 on host)
  - frontend: remove `stdin_open` and `tty`
  - frontend: add `build.args: VITE_API_URL=http://localhost:8000/api/v1`
  - backend: add `healthcheck` (curl localhost:8000/health every 30s)
  - mongo: add `healthcheck`

### US-004: Configurable API URL in frontend
**Description:** As a developer, I need the frontend API base URL to be configurable
via environment variable so the same Docker image works locally and in production.

**Acceptance Criteria:**
- [ ] `frontend/src/api/apiClient.ts` baseURL changed to:
  `import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1"`
- [ ] `backend/app/main.py` CORS `allow_origins` adds `http://localhost:5173` already present,
  also add `http://localhost:80` and `http://localhost` for nginx-served frontend
- [ ] `npm run build` passes with the change
- [ ] Typecheck passes

## Non-Goals

- No production Docker Compose (separate from dev)
- No CI/CD pipeline (separate PRD)
- No AWS-specific config (separate PRD)
- No hot-reload inside containers (dev uses local servers)
- Harrison PDF not mounted in container (ingestion script run locally only)

## Technical Considerations

- Inside Docker, services reach each other by service name: `mongo`, `redis`, `backend`
- The browser (on host) still calls `localhost:8000` for API — this works because Docker maps the port to the host
- `VITE_API_URL` is baked into the frontend at build time (`import.meta.env` is static)
- nginx needs `try_files $uri $uri/ /index.html` — without it, refreshing `/dashboard` returns 404
- `infra/env/.env.development` must NOT be committed (contains JWT secret + OpenAI key)

## Files to Create / Modify

| File | Action |
|---|---|
| `backend/Dockerfile` | Create |
| `backend/.dockerignore` | Create |
| `frontend/Dockerfile` | Create |
| `frontend/nginx.conf` | Create |
| `frontend/.dockerignore` | Create |
| `infra/env/.env.development` | Create (git-ignored) |
| `infra/env/.env.development.example` | Create (committed) |
| `infra/.gitignore` | Create |
| `infra/docker-compose.yml` | Update |
| `frontend/src/api/apiClient.ts` | Update baseURL |
| `backend/app/main.py` | Add localhost:80 to CORS |
