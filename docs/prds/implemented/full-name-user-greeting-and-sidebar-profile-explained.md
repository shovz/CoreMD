---
title: Full Name, User Greeting, and Sidebar Profile — Implementation Explanation
feature: Personalised user identity across registration, sidebar, and dashboard
status: fully implemented (US-001 – US-006)
---

# Full Name, User Greeting, and Sidebar Profile

## 1. What Was Implemented and Why

Users previously registered with email and password only — the app had no concept of who was logged in beyond a JWT. This feature adds a `full_name` field end-to-end so the platform can address residents by name and show a professional identity widget in the sidebar.

**What was shipped (US-001 – US-006):**

- Backend stores `full_name` in MongoDB at registration and returns it from `/auth/me` and `/auth/register`.
- The registration form now has a required "Full name" field above email.
- A new `AuthContext` loads the user's profile on app start and makes it available to every component.
- The sidebar bottom section replaced the old standalone "Logout" button with a profile widget: a circular blue "DR" badge, the user's last name, a "Resident" subtitle, and a "Sign Out" dropdown.
- The dashboard heading is now a dynamic, time-aware greeting: `"Good morning/afternoon/evening, Dr. [Last Name] ✦"`, replacing the static `"Study Deck"` text.

The motivation is personalisation and professionalism: residents on a medical education platform expect to see their identity reflected in the UI, and the "Dr. [Last Name]" convention matches how they think about themselves professionally.

---

## 2. Key Design Decisions

### `full_name` is optional in `UserOut` but required in `UserCreate`
`UserOut.full_name` defaults to `""` (`str = ""`), which keeps the API backward-compatible with any user documents in MongoDB that predate this feature (i.e., accounts that were created before `full_name` was added). `UserCreate.full_name` is a required `str` with no default, so every new registration must supply it.

### `/me` uses `deps/auth.get_current_user`, not `core/auth.get_current_user`
There are two `get_current_user` functions in the codebase. `core/auth.get_current_user` returns only the user's string `_id`. `deps/auth.get_current_user` returns the full MongoDB user document as a dict. The `/me` endpoint needs the latter to read `email`, `role`, and `full_name` — using the wrong one would break the response construction.

### AuthContext lives in `router.tsx`, wrapping the entire tree
`AuthProvider` is placed in `router.tsx` (outside `BrowserRouter`), which means every route — including unauthenticated ones — can call `useAuthContext()`. This is intentional: the login page needs to redirect once the user is known, and the sidebar (rendered inside `AppShell`) always needs access to `user`.

### Profile widget replaces the Logout button entirely
Rather than adding a name label next to an existing logout button, the sidebar now has a single interactive profile section that contains both identity display and the sign-out action. This reduces visual clutter and matches the design reference (circular badge + name + subtitle + dropdown).

### Last name extraction is client-side, via `full_name.split(" ").pop()`
The backend stores and returns the full name as a single string. The sidebar extracts the last name inline. This avoids a dedicated `last_name` field in the schema and keeps the data model simple — the only consumer of the last name is the sidebar badge.

### Badge falls back to email initial
If `full_name` is empty (existing accounts, or edge cases), `badgeText` becomes `user.email.charAt(0).toUpperCase()` rather than "DR". This prevents the badge from ever rendering blank.

---

## 3. MongoDB Document Shape

The `users` collection gains one new field. Documents created after this feature look like:

```json
{
  "_id": ObjectId("..."),
  "email": "jane.smith@hospital.org",
  "hashed_password": "$2b$12$...",
  "role": "user",
  "full_name": "Jane Smith",
  "created_at": "2026-04-26T10:00:00Z"
}
```

Documents created before this feature do not have `full_name`. The backend reads it safely with `current_user.get("full_name", "")` in the `/me` endpoint. No migration script is needed.

---

## 4. How to Use the Feature

### Registration
1. Navigate to `/register`.
2. Fill in **Full name** (required, above email), email, and password.
3. Submit — the account is created and you are redirected to `/login`.

### Sidebar profile widget
Once logged in, the bottom of the sidebar shows:
- A circular blue badge with "DR" text.
- The user's last name and "Resident" subtitle.
- Clicking the widget toggles a small dropdown with a **Sign Out** option.

### Backend endpoints (manual testing)

```bash
# Register (now requires full_name)
POST /auth/register
Content-Type: application/json
{"email": "jane@hospital.org", "password": "secret123", "full_name": "Jane Smith"}

# Returns full user out:
{"id": "...", "email": "jane@hospital.org", "role": "user", "full_name": "Jane Smith"}

# Get current user profile
GET /auth/me
Authorization: Bearer <jwt_token>
# Returns same UserOut shape
```

---

## 5. Files Changed

### `backend/app/models/user.py`
Added `full_name: str = ""` parameter to `UserInDB.__init__()` and included it in `to_mongo()`. The default ensures the model can still be constructed without a name (e.g., in tests).

### `backend/app/schemas/user.py`
- `UserCreate` — added required `full_name: str` field; new registrations must supply it.
- `UserOut` — added `full_name: str = ""` with a default for backward compatibility with pre-existing accounts.

### `backend/app/services/auth_service.py`
`register_user()` now passes `full_name=user_in.full_name` when constructing `UserInDB`. No other logic changed.

### `backend/app/api/v1/routes/auth.py`
- `/register` — constructs `UserOut` with `full_name=created.full_name` (using `hasattr` guard as a belt-and-suspenders safety measure, though the model always has the attribute now).
- `/me` — new endpoint that constructs `UserOut` from the full MongoDB dict: `full_name=current_user.get("full_name", "")`.

### `frontend/src/api/authApi.ts`
- `RegisterRequest` — added `full_name: string`.
- `LoginResponse` and `RegisterResponse` — added `full_name?: string` (optional because login tokens predate this field).
- Added `getMe(): Promise<LoginResponse>` — calls `GET /auth/me` via the authenticated `apiClient` and returns `response.data` directly (not the Axios wrapper), matching what `AuthContext` expects.

### `frontend/src/pages/RegisterPage.tsx`
Added a `fullName` state variable and a "Full name" text input rendered above the email field. The input is `required` and sent as `full_name` in the `register()` call.

### `frontend/src/context/AuthContext.tsx` _(new file)_
Provides `{ user, setUser, logout }` to the component tree via React context.

- **On mount:** if `localStorage.getItem("access_token")` is set, calls `getMe()` and stores the result in `user`. On a 401 response, clears the token and leaves `user` null.
- **`logout()`:** removes `access_token` from localStorage and sets `user` to null. Navigation to `/login` is handled by the Sidebar caller, not by the context itself.
- **`useAuthContext()`:** throws if called outside `<AuthProvider>`, preventing silent failures.

### `frontend/src/router.tsx`
Wraps the entire router tree in `<AuthProvider>` (outermost wrapper, outside `<AiContextProvider>` and `<BrowserRouter>`). This ensures `useAuthContext()` is available to every route and layout component.

### `frontend/src/components/Sidebar.tsx`
Imports `useAuthContext`. In `SidebarContent`:

- Reads `user` and `logout` from context.
- Computes `lastName` (`full_name.split(" ").pop()`) and `badgeText` ("DR" if name present, else email initial).
- Renders a profile widget button at the bottom: blue circular badge + name + "Resident" subtitle.
- Clicking the button toggles a `profileOpen` boolean that shows/hides a positioned dropdown containing a **Sign Out** button.
- **Removed:** the old standalone "Logout" button that previously lived below the nav links.

### `frontend/src/pages/DashboardPage.tsx`
Imports `useAuthContext` and reads `user`. On render, derives `timeOfDay` from `new Date().getHours()` (`< 12` → "Good morning", `< 17` → "Good afternoon", else "Good evening"), extracts the last name via `user?.full_name?.trim().split(/\s+/).at(-1) ?? ""`, and computes `greeting`. The `<h1>` now renders `{greeting}` instead of the hardcoded `"Study Deck"` string. The wrapper `div` also gained `px-6 py-8` padding classes to give the greeting appropriate breathing room.

---

## 6. Key Learnings

**The `deps/auth` vs `core/auth` split is a footgun.** Two functions named `get_current_user` exist in the codebase — one returning a string ID, the other returning the full user dict. The PRD called this out explicitly. Any new endpoint that needs user fields beyond the ID must import from `app.api.deps.auth`, not `app.core.auth`.

**Context placement matters for wrapping order.** `AuthProvider` must be the outermost provider so that child contexts (like `AiContextProvider`) and route components can safely call `useAuthContext()`. Inverting the order would cause the hook to throw for any component rendered inside `AiContextProvider` but outside `AuthProvider`.

**`getMe()` returns `r.data` directly (not the Axios response).** The other API functions return the full Axios response object and leave `.data` access to the caller. `getMe()` breaks that convention by returning `r.data` directly — this was necessary because `AuthContext` calls `getMe().then(setUser)` and `setUser` expects a `LoginResponse`, not an `AxiosResponse<LoginResponse>`. A future refactor should standardise the API layer pattern.

**The PRD specified `split(" ").pop()` for last-name extraction; the implementation uses `split(/\s+/).at(-1)`.** The regex split handles names with multiple consecutive spaces and the ES2022 `at(-1)` is null-safe (returns `undefined` rather than throwing on an empty array). Both the sidebar and the dashboard use the same pattern.
