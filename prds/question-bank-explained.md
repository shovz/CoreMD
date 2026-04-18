# Question Bank — Implementation Explained

## 1. What Was Implemented and Why

The Question Bank feature gives internal medicine residents a set of MCQ (multiple-choice question) cards tied to Harrison's chapters. Before this work, the backend had skeleton routes and an attempt-recording service but no question data and no working API or UI. All five user stories are now complete:

| Story | Scope |
|---|---|
| US-001 | MongoDB seed script — 20 MCQs across 6 specialties |
| US-002 | Questions listing and filtering API |
| US-003 | Attempt endpoint returning correctness feedback + explanation |
| US-004 | `QuestionsPage` — browseable, filterable question list |
| US-005 | `QuestionDetailPage` — attempt UI with per-option feedback |

---

## 2. Key Design Decisions

### Anti-cheating field split
Two Pydantic models are used instead of one:

- `QuestionOut` — returned by `GET /questions/` and displayed in the list view; omits `correct_option` and `explanation`. A client that only calls this endpoint cannot reconstruct the answer.
- `QuestionFull` — extends `QuestionOut` with `correct_option` and `explanation`; returned by `GET /questions/{question_id}` (the detail page fetch) and used internally by the attempt route.

The frontend `QuestionDetailPage` calls `GET /questions/{id}` to load the full question (stem + options) when the page opens, then calls `POST /questions/{id}/attempt` when the user clicks an option. `correct_option` is only meaningful once the attempt response arrives — the detail-page fetch includes it, but it is not displayed until the attempt is submitted.

### Idempotent seeding with a unique index
The seed script creates a unique MongoDB index on `question_id` before any inserts, then uses `find_one` before each `insert_one`. Re-running the script is safe: existing questions are counted as "skipped" and nothing is duplicated. The index is also a guard against concurrent runs inserting the same document twice (the `find_one` pre-check gives a human-readable "skipped" count rather than a `DuplicateKeyError`).

### `question_id` format
IDs follow the pattern `q_{part}_{chapter}_{index}` (e.g., `q_p06_c238_001`), which mirrors the `chapter_id` format produced by the PDF ingestion pipeline. This makes `chapter_ref` a stable, human-readable foreign key that can be joined to the `chapters` collection without a lookup table.

### `.env` loading in standalone scripts
The seed script wraps the `dotenv` import in a `try/except ImportError` block so it degrades gracefully in environments where `python-dotenv` is not installed. `MONGO_URI` defaults to `mongodb://localhost:27017/CoreMD` if absent. The database name is derived from `MongoClient.get_default_database()` (reads the `/CoreMD` segment from the URI) with a string-parse fallback.

### Dynamic filter query construction
The API builds a MongoDB query dict only from the parameters actually supplied — nothing is added for `None` values. This avoids MongoDB treating an absent filter as `{"topic": null}` and missing all documents.

### Filter state in `useState`, not URL params
The questions list page manages `difficulty` and `topic` filter state with React `useState`. Changing either fires a fresh `getQuestions()` call via `useEffect` with both filters as dependencies. No URL sync was added for MVP — keeping filter state local avoids the complexity of URL encoding/decoding and back-button handling at this stage.

### Attempt recording reuses the existing service
`POST /questions/{question_id}/attempt` calls `question_attempt_service.record_attempt()` directly rather than duplicating its logic. The service writes to the `question_attempts` collection and invalidates the three Redis stats cache keys for that user (`stats:overview:`, `stats:questions:`, `stats:chapters:`).

### Option coloring in the attempt UI
After submission, `getOptionStyle(index)` produces one of three visual states:
- **Green** — the correct option (`index === result.correct_option`)
- **Red** — the selected wrong option (`index === selected && !result.correct`)
- **Greyed out** — all other options

All buttons are disabled immediately on click (before the response arrives) by checking `!!result || submitting`, preventing double-submission.

---

## 3. MongoDB Document Shapes

### `questions` collection

```json
{
  "question_id": "q_p06_c238_001",
  "stem": "A 65-year-old man presents with exertional dyspnea and ankle edema. Which physical exam finding is most consistent with right heart failure?",
  "options": [
    "S3 gallop at the apex",
    "Jugular venous distension",
    "Bilateral crackles at the lung bases",
    "Displaced apical impulse"
  ],
  "correct_option": 1,
  "explanation": "Jugular venous distension (JVD) reflects elevated right atrial pressure, the hallmark of right heart failure. ...",
  "topic": "Cardiology",
  "chapter_ref": "p06_c238",
  "difficulty": "medium"
}
```

**Field notes:**

| Field | Type | Notes |
|---|---|---|
| `question_id` | `str` | Natural key; unique index enforced |
| `stem` | `str` | Clinical vignette or direct question |
| `options` | `list[str]` | Always 4 choices, 0-indexed |
| `correct_option` | `int` | 0-indexed position of the correct answer |
| `explanation` | `str` | Shown only after an attempt |
| `topic` | `str` | Specialty label (e.g. `"Cardiology"`) |
| `chapter_ref` | `str` | Foreign key to `chapters.chapter_id` |
| `difficulty` | `str` | One of `"easy"`, `"medium"`, `"hard"` |

The `_id` field (MongoDB ObjectId) is excluded from all API responses via `{"_id": 0}` projection.

### `question_attempts` collection

Written by `record_attempt()` on every `POST /questions/{id}/attempt` call.

```json
{
  "user_id": ObjectId("..."),
  "question_id": "q_p06_c238_001",
  "selected_option": 2,
  "correct_option": 1,
  "is_correct": false,
  "created_at": "2026-04-13T10:00:00Z"
}
```

`is_correct` is derived at write time (`selected_option == correct_option`), so stat queries can filter without recomputing it.

---

## 4. How to Run

### Seed questions into MongoDB

```bash
# From the project root
python backend/scripts/seed_questions.py
```

Expected output (first run):
```
Seed complete — 20 questions in dataset: 20 inserted, 0 already present.
```

Re-running:
```
Seed complete — 20 questions in dataset: 0 inserted, 20 already present.
```

Requires `MONGO_URI` in `backend/.env` (defaults to `mongodb://localhost:27017/CoreMD`).

### Start the API

```bash
cd backend
python -m uvicorn app.main:app --reload   # http://localhost:8000
```

### Start the frontend

```bash
cd frontend
npm run dev   # http://localhost:5173
```

Navigate to `/questions` to browse the question bank. Click "Attempt →" on any row to open the attempt UI.

### Example API calls

```bash
# List all questions (JWT required)
GET /questions/

# Filter by topic and difficulty
GET /questions/?topic=Cardiology&difficulty=medium

# Filter by chapter
GET /questions/?chapter_id=p06_c238

# Full question (includes answer + explanation — used by detail page)
GET /questions/q_p06_c238_001

# Submit an attempt
POST /questions/q_p06_c238_001/attempt
{"selected_option": 1}
# → {"correct": true, "correct_option": 1, "explanation": "..."}
```

---

## 5. Files Changed

| File | Action | What it does |
|---|---|---|
| `backend/scripts/seed_questions.py` | Created | Seeds 20 MCQs (6 specialties, 3 difficulty levels) into the `questions` collection. Idempotent. |
| `backend/app/schemas/question.py` | Created | `Difficulty` enum; `QuestionOut` (safe for list view, omits answer fields); `QuestionFull` (includes `correct_option` and `explanation`). |
| `backend/app/api/v1/routes/questions.py` | Replaced stub | Implements `GET /questions/` (filterable, paginated), `GET /questions/{id}` (full question), and `POST /questions/{id}/attempt` (records attempt, returns feedback). All routes require JWT. |
| `frontend/src/api/questionsApi.ts` | Created | Axios wrappers: `getQuestions(filters?)`, `getQuestionById(id)`, `submitAttempt(questionId, selectedOption)`. TypeScript types for `QuestionOut`, `QuestionFull`, `AttemptResult`. |
| `frontend/src/pages/QuestionsPage.tsx` | Created | Question list UI with difficulty dropdown and topic text filter. Re-fetches on filter change via `useEffect`. Each row shows topic + difficulty badges and an "Attempt →" link. |
| `frontend/src/pages/QuestionDetailPage.tsx` | Created | Attempt UI: loads full question on mount, renders 4 option buttons. On click, submits attempt, disables all buttons, highlights correct (green) / wrong (red) options, and displays explanation. |
| `frontend/src/router.tsx` | Modified | Added protected routes `/questions` → `QuestionsPage` and `/questions/:id` → `QuestionDetailPage`. |

---

## 6. Key Learnings (from progress.txt)

**Env loading in standalone scripts**

Scripts that run outside the FastAPI app context cannot rely on the app's startup to load environment variables. The safe pattern:

```python
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")
except ImportError:
    pass  # degrade gracefully if python-dotenv is absent
```

Always resolve `.env` relative to `__file__`, not the current working directory, so the script works regardless of where it is invoked from.

**Database name from URI**

Rather than hard-coding the database name, derive it from the URI itself:

```python
try:
    db_name = MongoClient(MONGO_URI).get_default_database().name
except Exception:
    db_name = MONGO_URI.rsplit("/", 1)[-1].split("?")[0] or "CoreMD"
```

This keeps the script in sync with any URI change and avoids a separate config variable.

**Idempotency via unique index + pre-check**

Creating a unique index on the natural key before seeding serves two purposes: it prevents silent duplicates from concurrent runs, and it documents that `question_id` is the stable identifier. The `find_one` pre-check is complementary — it produces a meaningful "skipped" count rather than a raised `DuplicateKeyError`.
