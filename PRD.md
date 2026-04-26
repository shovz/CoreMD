# PRD: Full Name, User Greeting, and Sidebar Profile

## Introduction

Currently users register with only email and password. Adding a full name field enables a personalised "Good morning, Dr. Smith" greeting on the dashboard and a professional user profile widget at the bottom of the sidebar — matching the visual reference showing a circular DR badge, the doctor's last name, and a logout dropdown.

## Goals

- Registration collects the user's full name and stores it in MongoDB
- The `/me` API endpoint returns `full_name`
- An `AuthContext` provides the current user's profile to all components
- The sidebar shows a DR badge + last name + "Resident" subtitle with a logout dropdown
- The dashboard greeting is dynamic: "Good morning/afternoon/evening, Dr. [Last Name] ✦"

## User Stories

### US-001: Backend — add full_name to user model and schemas
**Description:** As a developer, I need the user's full name stored in MongoDB and returned by the API so all frontend components can display it.

**Acceptance Criteria:**
- [x] `backend/app/models/user.py` `UserInDB.__init__()` accepts `full_name: str = ""` and includes it in `to_mongo()`
- [x] `backend/app/schemas/user.py` `UserCreate` has `full_name: str` (required, non-empty)
- [x] `backend/app/schemas/user.py` `UserOut` has `full_name: str = ""` (optional with default for backward compat)
- [x] `backend/app/services/auth_service.py` `register_user()` passes `full_name=user_in.full_name` to `UserInDB`
- [x] Typecheck passes (run `cd backend && python -c "from app.schemas.user import UserCreate, UserOut; print('ok')"`)

### US-002: Backend — /me endpoint returns full_name
**Description:** As a developer, I need the `/auth/me` endpoint to include `full_name` in its response so the frontend can load the user's profile on app startup.

**Acceptance Criteria:**
- [x] `backend/app/api/v1/routes/auth.py` `/me` endpoint constructs `UserOut` with `full_name=current_user.get("full_name", "")` (current_user is the full MongoDB dict from `deps/auth.get_current_user`)
- [x] `/register` response also includes `full_name` (it returns `UserOut` which already gains the field from US-001)
- [x] Typecheck passes

### US-003: Frontend — authApi.ts update + RegisterPage full_name field
**Description:** As a new user, I want to enter my full name at registration so the platform can address me personally.

**Acceptance Criteria:**
- [x] `frontend/src/api/authApi.ts` `RegisterRequest` has `full_name: string`
- [x] `frontend/src/api/authApi.ts` `LoginResponse` and `RegisterResponse` have `full_name?: string`
- [x] `frontend/src/api/authApi.ts` exports `getMe(): Promise<LoginResponse>` calling `GET /auth/me` via the authenticated apiClient
- [x] `frontend/src/pages/RegisterPage.tsx` has a "Full name" text input (above email), bound to local state, sent as `full_name` in the register call
- [x] Typecheck passes
- [x] Verify changes work in browser: register form shows full name field

### US-004: Frontend — AuthContext providing current user profile
**Description:** As a developer, I need a React context that loads and exposes the authenticated user's profile (including full_name) so components like Sidebar and Dashboard can access it without prop drilling.

**Acceptance Criteria:**
- [x] New file `frontend/src/context/AuthContext.tsx` created
- [x] Context provides: `user: LoginResponse | null`, `setUser`, `logout()` (clears localStorage token + sets user to null)
- [x] On mount: if `localStorage.getItem("token")` exists, calls `getMe()` and sets `user`; on 401 clears token
- [x] `frontend/src/main.tsx` (or `App.tsx`) wraps the app in `<AuthProvider>`
- [x] `useAuthContext()` hook exported from the same file
- [x] Typecheck passes

### US-005: Frontend — Sidebar user profile widget
**Description:** As a resident, I want to see my name and a logout option at the bottom of the sidebar so I always know who I'm logged in as.

**Acceptance Criteria:**
- [x] `frontend/src/components/Sidebar.tsx` imports `useAuthContext`
- [x] A profile section appears at the bottom of the sidebar (above the existing Ask AI and Logout buttons, replacing the standalone Logout button)
- [x] Shows: circular blue badge with "DR" text + last name (`full_name.split(" ").pop()`) + "Resident" subtitle
- [x] Falls back to showing email initial if `full_name` is empty
- [x] Clicking the profile section toggles a small dropdown with a "Sign Out" option that calls `logout()` from AuthContext
- [x] The old standalone Logout button is removed from the sidebar
- [x] Typecheck passes
- [x] Verify changes work in browser

### US-006: Frontend — Dashboard dynamic greeting
**Description:** As a resident, I want to see a personalised time-aware greeting on the dashboard so the app feels welcoming.

**Acceptance Criteria:**
- [ ] `frontend/src/pages/DashboardPage.tsx` imports `useAuthContext`
- [ ] The greeting text is computed: `hour < 12 → "Good morning"`, `hour < 17 → "Good afternoon"`, else `"Good evening"`
- [ ] The greeting renders as: `"Good morning, Dr. [Last Name] ✦"` (last name extracted from `user?.full_name`)
- [ ] If `full_name` is empty or null, renders `"Good morning, Doctor ✦"` as fallback
- [ ] Only the greeting text changes — all other dashboard content remains unchanged
- [ ] Typecheck passes
- [ ] Verify changes work in browser

## Non-Goals

- No PGY year or specialty tracking
- No profile edit page (name is set at registration, not editable)
- No avatar image upload
- No role-based access changes

## Technical Considerations

- `deps/auth.get_current_user` in `backend/app/api/deps/auth.py` returns the full MongoDB user dict — use `current_user.get("full_name", "")` to safely access the field
- `core/auth.get_current_user` returns a string (user_id only) — do NOT use this for the /me endpoint
- `AuthContext` must handle the case where `getMe()` fails (network error or expired token) by clearing localStorage and setting user to null
