# Repository Guidelines

## Project Structure & Module Organization
CoreMD is split into `frontend/` (React + TypeScript + Vite) and `backend/` (FastAPI).
- `frontend/src/`: UI pages, shared components, router, and API clients (`src/api/*Api.ts`).
- `frontend/tests/`: Playwright end-to-end specs (`*.spec.ts`).
- `backend/app/`: API routes (`api/v1/routes`), schemas, services, DB adapters (`db/`), and app entrypoint (`main.py`).
- `backend/tests/`: pytest API tests (`test_*.py`) and fixtures (`conftest.py`).
- `backend/scripts/`: ingestion and seeding scripts.
- `infra/`: Docker Compose, CloudFormation, and deployment scripts.

## Build, Test, and Development Commands
Frontend (run in `frontend/`):
- `npm run dev`: start Vite dev server.
- `npm run build`: type-check and production build to `dist/`.
- `npm run lint`: run ESLint.
- `npx playwright test`: run E2E specs in `tests/`.

Backend (run in `backend/`):
- `python -m uvicorn app.main:app --reload`: start API locally.
- `pytest`: run backend tests.

Full stack (run in `infra/`):
- `docker compose up --build`: start frontend, backend, MongoDB, and Redis.

## Coding Style & Naming Conventions
- Python: PEP 8, 4-space indentation, `snake_case` for functions/modules, `PascalCase` for classes.
- TypeScript/React: 2-space indentation, `PascalCase` for components/pages, `camelCase` for variables/functions, API modules named `*Api.ts`.
- Run `npm run lint` before opening a PR. Keep route files and service files focused by feature.

## Testing Guidelines
- Backend uses `pytest` + `pytest-asyncio`; place tests in `backend/tests/test_*.py`.
- Frontend E2E uses Playwright; name specs `*.spec.ts` in `frontend/tests/`.
- Add or update tests for any changed endpoint, auth flow, or critical UI path.

## Commit & Pull Request Guidelines
- Follow Conventional Commits used in history: `feat: ...`, `fix: ...`, `chore: ...` (optional scope).
- Keep commits small and logical; avoid mixing infra, backend, and frontend refactors in one commit.
- PRs should include: purpose, key changes, test evidence (pytest/Playwright/lint output), related issue/task, and screenshots for UI changes.

## Security & Configuration Tips
- Do not commit secrets; use `backend/.env` and `infra/env/*.example` templates.
- Required backend envs include `MONGO_URI`, `REDIS_URL`, `JWT_SECRET`, and `OPENAI_API_KEY` (when AI features are used).
