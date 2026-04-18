# Case Studies — Implementation Explained

## 1. What Was Implemented and Why

Case studies are a primary learning tool for internal medicine residents: a structured clinical scenario walks through a real patient encounter (history, exam, labs, imaging, diagnosis, management) so the resident can reason through it independently before checking answers.

Before this work the backend `cases.py` route was a stub returning an empty list. This PRD completed the full vertical slice: seeding real clinical data, exposing a listing + detail API, and building both frontend pages.

| Story | Scope |
|---|---|
| US-001 | `seed_cases.py` — 22 clinical cases across 8 specialties inserted into MongoDB; Pydantic schemas for API responses |
| US-002 | `GET /cases/` (list with optional specialty filter) and `GET /cases/{case_id}` (detail); replaces the stub |
| US-003 | `CasesPage.tsx` — browse page with specialty filter dropdown, case cards, "View Case" links |
| US-004 | `CaseDetailPage.tsx` — full case viewer with all 8 sections and a toggleable "Show Hint" that reveals the Harrison's chapter reference |

All four stories are complete. No other backend endpoints were modified.

---

## 2. Key Design Decisions

### Idempotent seed script via unique index
`seed_cases.py` calls `create_index("case_id", unique=True)` before any inserts, then wraps each insert in a try/except for `DuplicateKeyError`. Re-running the script is safe — already-present cases are skipped and the inserted count reflects only new documents. This means the script can be run in CI or against a partially-seeded database without corrupting data.

### `case_id` format as a stable natural key
Cases use `case_{specialty_slug}_{index:03d}` (e.g. `case_cardiology_001`). The slug is lowercase with no spaces, making the ID URL-safe, human-readable in logs, and stable across re-seeds. Using a natural key instead of a generated ObjectId lets frontend `<Link>` paths be meaningful and keeps the seed script deterministic.

### Chapter title resolved at request time, not stored
`CaseOut` includes an optional `chapter_title` field that is populated by the detail endpoint at query time — the API looks up `db["chapters"].find_one({"id": chapter_ref})` and attaches the title if found. The raw `chapter_ref` ID is stored in the `cases` document; the human-readable title is not duplicated there. This avoids stale data if a chapter title is ever corrected in the `chapters` collection.

### Client-side specialty filtering
The listing page fetches all cases in one request and filters in the browser using `useMemo`. Because the MVP dataset is ≤25 cases, a round-trip per filter change would add latency without benefit. The filter dropdown is populated dynamically from `Array.from(new Set(...))` on the fetched list, so it always reflects exactly what is in the database. The API also supports a `?specialty=` query param (used server-side when the list grows).

### `SECTIONS` array drives the detail page layout
`CaseDetailPage.tsx` defines a static `SECTIONS` array of `{ key, label }` pairs and maps over it to render each section block. This means adding, removing, or reordering sections requires one change in one place — not edits scattered across JSX. The section keys are typed as `keyof CaseFull`, so TypeScript catches any key mismatch at build time.

### Specialty color map with fallback
`CasesPage.tsx` maps specialty names to badge colors via a `SPECIALTY_COLORS` record keyed by lowercase prefix (e.g. `"cardiology"`, `"infectious"`). The lookup uses `key.includes(prefix)` to handle "Infectious Disease" matching `"infectious"`. Any unrecognised specialty falls back to a neutral grey (`#455a64`) — new specialties added to the seed data degrade gracefully rather than crashing.

### Hint is local state, not URL state
The "Show Hint" toggle is implemented as `useState(false)` in `CaseDetailPage`. The PRD explicitly notes that URL state is not needed here — the hint is a transient reading aid, not something a resident would bookmark or share. Keeping it in local state keeps the URL clean and the component simple.

---

## 3. MongoDB Document Shape

### `cases` collection

One document per case. 22 documents are inserted by the seed script.

```json
{
  "case_id": "case_cardiology_001",
  "title": "Inferior STEMI in a 58-Year-Old Diabetic Man",
  "specialty": "Cardiology",
  "presentation": "A 58-year-old man with type 2 diabetes...",
  "history": "PMH: T2DM (10 years), hypertension...",
  "physical_exam": "BP 155/95, HR 102 bpm, RR 18...",
  "labs": "Troponin I: 4.2 ng/mL (elevated)...",
  "imaging": "ECG: ST elevations in II, III, aVF...",
  "discussion": "Inferior STEMI is most commonly caused by occlusion of the RCA...",
  "diagnosis": "Inferior ST-elevation myocardial infarction (STEMI) due to acute RCA occlusion.",
  "management": "Aspirin 325 mg + P2Y12 inhibitor...",
  "chapter_ref": "p06_c238"
}
```

`chapter_ref` uses the `p{part:02d}_c{chapter:03d}` format that matches `chapter_id` values in the `chapters` collection produced by the PDF ingestion script. `chapter_title` is **not** stored here — it is resolved at read time from the `chapters` collection.

A unique index on `case_id` enforces idempotency and serves as the lookup key for the detail endpoint.

**Specialties seeded (8 total, ~2–3 cases each):**
Cardiology, Pulmonology, Nephrology, Gastroenterology, Endocrinology, Hematology, Infectious Disease, Neurology.

---

## 4. How to Run

### Seed the database (one-time, idempotent)

```bash
# From project root — requires MONGO_URI in backend/.env
python backend/scripts/seed_cases.py
```

Expected output: `Inserted X new case(s). Skipped Y duplicate(s).`

The script loads `backend/.env` automatically via `python-dotenv`. If `dotenv` is not installed it falls back to the environment variable `MONGO_URI` (defaulting to `mongodb://localhost:27017/CoreMD`).

### Start the backend

```bash
cd backend
python -m uvicorn app.main:app --reload   # http://localhost:8000
```

Verify the API:
```
GET http://localhost:8000/cases/
GET http://localhost:8000/cases/?specialty=Cardiology
GET http://localhost:8000/cases/case_cardiology_001
```
All routes require `Authorization: Bearer <token>`.

### Start the frontend

```bash
cd frontend
npm run dev   # http://localhost:5173
```

Navigate to `/cases` to browse the case list. Click "View Case" to open a detail page. Scroll to the bottom and click "Show Hint" to reveal the Harrison's chapter reference.

### Type checking

```bash
cd frontend && npm run build   # TypeScript check + Vite bundle
cd backend && mypy app/        # if mypy is configured
```

---

## 5. Files Changed

| File | Action | What it does |
|---|---|---|
| `backend/scripts/seed_cases.py` | Created | Inserts 22 clinical case documents into the `cases` MongoDB collection. Enforces a unique index on `case_id` for idempotency. Reads `MONGO_URI` from `backend/.env`. Prints inserted/skipped counts. |
| `backend/app/schemas/case.py` | Created | Pydantic response models: `CaseOut` (all 12 fields + optional `chapter_title`) used by the detail endpoint; `CaseListItem` (3 fields) used by the listing endpoint. Both carry `orm_mode = True` for MongoDB dict compatibility. |
| `backend/app/api/v1/routes/cases.py` | Replaced stub | Implements `GET /cases/` (list, optional `?specialty=` filter) and `GET /cases/{case_id}` (detail with chapter title join). Both endpoints require a valid JWT via `get_current_user`. Returns 404 for unknown `case_id`. |
| `frontend/src/api/casesApi.ts` | Created | Typed Axios wrappers: `getCases(specialty?)` → `CaseListItem[]` and `getCaseById(id)` → `CaseFull`. Defines the `CaseListItem` and `CaseFull` TypeScript interfaces mirroring the Pydantic schemas. Uses the existing `apiClient` instance for automatic auth header injection. |
| `frontend/src/pages/CasesPage.tsx` | Created | Browse page. Fetches all cases on mount, derives specialty list and filtered view with `useMemo`. Renders a specialty dropdown and a list of case cards (title, colored specialty badge, "View Case" link). Handles loading and error states. |
| `frontend/src/pages/CaseDetailPage.tsx` | Created | Case detail page. Reads `:id` from URL params, fetches the full case, renders all 8 sections via the `SECTIONS` array map pattern. Includes a "Show Hint" toggle button that reveals `chapter_title — chapter_ref` in a green callout box. |
| `frontend/src/router.tsx` | Modified | Added two protected routes: `/cases` → `CasesPage` and `/cases/:id` → `CaseDetailPage`. |
| `frontend/src/pages/Home.tsx` | Modified | Added a "Cases" nav link pointing to `/cases`. |

---

## 6. Key Learnings (from progress.txt)

No learnings were recorded in `progress.txt` during this implementation — the feature went in cleanly against a well-specified PRD with no unexpected obstacles.
