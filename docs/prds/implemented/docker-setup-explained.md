# Docker Setup — Implementation Explained

## 1. What Was Implemented and Why

CoreMD had a `docker-compose.yml` that referenced `build: ../backend` and `build: ../frontend`, but neither directory contained a `Dockerfile`, so `docker-compose up` failed immediately. This work adds everything needed to run the full stack — FastAPI backend, React frontend (via nginx), MongoDB, and Redis — with a single command from `infra/`.

The setup is also the foundation for future AWS/ECS deployment: ECS runs the same images, so getting containers working locally means production is mostly solved.

---

## 2. Key Design Decisions and Reasoning

### Two-stage frontend build
The frontend Dockerfile uses a two-stage build: a `node:20-alpine` stage runs `npm ci` and `npm run build`, then an `nginx:alpine` stage copies only the compiled `dist/` folder. This keeps the final image small — Node and all dev dependencies are discarded.

### nginx for the frontend, not Node
The built React app is static HTML/JS/CSS. nginx serves it far more efficiently than `npm run dev` (which is a dev-only Vite server). nginx also handles the SPA routing requirement cleanly with a single `try_files` directive.

### SPA fallback in nginx.conf
React Router handles navigation client-side. Without `try_files $uri $uri/ /index.html`, refreshing any deep URL like `/dashboard` asks nginx for a file at that path, which doesn't exist, returning a 404. The fallback sends all unmatched paths back to `index.html` so React Router takes over.

### Docker service names in env file
Inside Docker's network, services reach each other by their `docker-compose.yml` service name, not `localhost`. So `MONGO_URI` uses `mongodb://mongo:27017/CoreMD` and `REDIS_URL` uses `redis://redis:6379`. The browser on the host still uses `localhost:8000` for API calls because Docker maps that port to the host — so both work simultaneously.

### `VITE_API_URL` baked at build time
Vite's `import.meta.env` variables are statically replaced at build time, not runtime. This means `VITE_API_URL` must be passed as a Docker `build.arg`, not a regular container environment variable. The default `http://localhost:8000/api/v1` works for local Docker usage; a production build passes a different value.

### Separate example env file
`infra/env/.env.development` holds real secrets (JWT secret, OpenAI key) and is git-ignored. `infra/env/.env.development.example` is a sanitized copy with blank secret values and is committed — so new developers know exactly what to fill in without exposing anything sensitive.

### Port mapping: `5173:80`
nginx listens on port 80 inside the container. The host maps it to `5173` to match the existing local dev convention, so the frontend URL stays `http://localhost:5173` whether running containerised or locally.

---

## 3. MongoDB Document Shapes Produced

This feature does not write to MongoDB. It only ensures the stack wires together correctly so the existing application code (which does write to MongoDB) can run inside containers.

The existing MongoDB collections and document shapes are unchanged. See the AI/RAG and chapter ingestion PRDs for those shapes.

---

## 4. How to Run

**Start the full stack:**
```bash
cd infra
docker-compose up
```

Services started:
| Service  | Host URL                   |
|----------|----------------------------|
| Frontend | http://localhost:5173      |
| Backend  | http://localhost:8000      |
| MongoDB  | mongodb://localhost:27017  |
| Redis    | redis://localhost:6379     |

**Before first run**, copy the example env file and fill in secrets:
```bash
cp infra/env/.env.development.example infra/env/.env.development
# Edit .env.development: set JWT_SECRET and OPENAI_API_KEY
```

**Build images individually (optional):**
```bash
docker build -t coremd-backend ./backend
docker build -t coremd-frontend ./frontend
```

---

## 5. Files Changed and What Each Does

| File | Action | Purpose |
|---|---|---|
| `backend/Dockerfile` | Created | Builds the FastAPI image: `python:3.11-slim`, installs `requirements.txt`, copies `app/` and `scripts/`, runs uvicorn on `0.0.0.0:8000` |
| `backend/.dockerignore` | Created | Excludes `.env`, `__pycache__`, `*.pyc`, `.venv` from the build context — keeps image clean and prevents accidental secret inclusion |
| `frontend/Dockerfile` | Created | Two-stage build: Node 20 compiles the React app, nginx:alpine serves the resulting `dist/` |
| `frontend/nginx.conf` | Created | Configures nginx to serve the SPA on port 80 with `try_files` fallback to `index.html` for client-side routing |
| `frontend/.dockerignore` | Created | Excludes `node_modules`, `dist`, and `.env*` from the build context |
| `infra/env/.env.development` | Created (git-ignored) | Real environment variables for the containerised backend: Docker-network URIs, JWT secret, OpenAI key placeholder |
| `infra/env/.env.development.example` | Created (committed) | Sanitized template with blank secret values, safe to commit, documents required variables for new developers |
| `infra/.gitignore` | Created | Ignores `env/.env.development` while leaving `env/.env.development.example` committable |
| `infra/docker-compose.yml` | Updated | Fixed frontend ports (`5173:80`), removed dev-only `stdin_open`/`tty`, added `VITE_API_URL` build arg, added healthchecks for backend and MongoDB |
| `frontend/src/api/apiClient.ts` | Updated | Changed `baseURL` to `import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1"` so the API URL is configurable per environment |
| `backend/app/main.py` | Updated | Added `http://localhost:80` and `http://localhost` to CORS `allow_origins` to cover the nginx-served frontend |

---

## 6. Key Learnings from Implementation

**Windows `.gitignore` case-insensitivity trap**
On Windows (case-insensitive filesystem), a root `.gitignore` rule like `ENV/` matches `infra/env/` — the case difference is ignored. The fix is to add negation patterns in the root `.gitignore` after the virtual-env rules:
```
!infra/env/
!infra/env/**
```
Then `infra/.gitignore` can selectively re-ignore `env/.env.development` while leaving the `.example` file committable. Without the negation, the entire `infra/env/` directory was invisible to git.

**VITE_ vars are build-time, not runtime**
Unlike backend environment variables injected at container startup, Vite replaces `import.meta.env.VITE_*` statically during the build step. They must be passed as Docker `build.args` in `docker-compose.yml`, not as `environment:` entries — otherwise the built JS contains the literal string `import.meta.env.VITE_API_URL` rather than the resolved value.

**CORS must include nginx origins**
When the frontend is served by nginx (not Vite), the browser's `Origin` header sends `http://localhost` or `http://localhost:80`, not `http://localhost:5173`. The backend CORS config must explicitly allow both forms, or all API calls from the containerised frontend will be blocked by the browser.
