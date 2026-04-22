# Expanded Test Data — Implementation Explained

**PRD:** `PRD.md` (US-001: 100 questions, US-002: 40 cases)
**Commits:** `feat: US-001 expand question bank to 100 questions`, `feat: US-002 expand case library to 40 cases`

---

## 1. What Was Implemented and Why

CoreMD launched with 20 MCQ questions and 22 clinical cases — far too few for a realistic learning tool. A resident could exhaust the entire question bank in a single session. This work expanded both datasets to production-credible sizes:

- **100 MCQs** across 12 subspecialties (`seed_questions.py`)
- **40 clinical cases** across 10 subspecialties (`seed_cases.py`)

All content is hand-authored, grounded in Harrison's 21st Edition, and tied to real chapter references already in the database.

---

## 2. Key Design Decisions

### Idempotent insert-or-skip (not upsert)
Each script checks `find_one({"question_id": ...})` / `find_one({"case_id": ...})` before calling `insert_one`. If the document already exists it is skipped; otherwise it is inserted. This deliberately avoids `update_one(..., upsert=True)` so that any manual edits made to a seeded document in production are not overwritten by a re-run.

### Unique index created at seed time
Both scripts call `collection.create_index("question_id"/"case_id", unique=True)` before iterating. If two records with the same ID are accidentally added to the Python list, MongoDB will raise on the second insert rather than silently creating a duplicate.

### `chapter_ref` format ties to ingestion output
All `chapter_ref` values follow the pattern `p{part:02d}_c{chapter:03d}` (e.g., `p06_c238`). This is the format produced by the PDF ingestion pipeline and stored as `chapter_id` in the `chapters` collection. Questions and cases must only reference `chapter_id` values that actually exist in MongoDB — wrong values will produce dead links in the UI.

### Question IDs encode location
Questions use IDs like `q_p06_c238_001` (part 06, chapter 238, sequence 001). This is more informative than a plain numeric counter and makes it easy to group or filter by chapter later.

### Case IDs encode specialty
Cases use IDs like `case_cardiology_001`. This differs from the original `case_023` style specified in the PRD. The new format is more readable and avoids collisions when adding cases to a specialty independently.

### Difficulty distribution
Questions target approximately 30 easy / 50 medium / 20 hard. This is enforced by code review of the data list, not programmatically; there is no runtime validation.

---

## 3. MongoDB Document Shapes

### `questions` collection

```json
{
  "_id": "<ObjectId>",
  "question_id": "q_p06_c238_001",
  "stem": "A 65-year-old man presents with...",
  "options": [
    "S3 gallop at the apex",
    "Jugular venous distension",
    "Bilateral crackles at the lung bases",
    "Displaced apical impulse"
  ],
  "correct_option": 1,
  "explanation": "Jugular venous distension (JVD) reflects...",
  "topic": "Cardiology",
  "chapter_ref": "p06_c238",
  "difficulty": "medium"
}
```

Notes:
- `options` is a **list** (not a dict with A/B/C/D keys).
- `correct_option` is a **0-indexed integer** (0 = first option, 1 = second, etc.).
- The PRD spec uses the field name `question`; the implementation uses `stem`. Any API layer that reads this collection must use `stem`.

### `cases` collection

```json
{
  "_id": "<ObjectId>",
  "case_id": "case_cardiology_001",
  "title": "Inferior STEMI in a 58-Year-Old Diabetic Man",
  "specialty": "Cardiology",
  "presentation": "A 58-year-old man with type 2 diabetes...",
  "history": "PMH: T2DM (10 years), hypertension...",
  "physical_exam": "BP 155/95, HR 102 bpm...",
  "labs": "Troponin I: 4.2 ng/mL (elevated)...",
  "imaging": "ECG: ST elevations in II, III, aVF...",
  "discussion": "Inferior STEMI is most commonly caused by...",
  "diagnosis": "Inferior ST-elevation myocardial infarction (STEMI) due to acute RCA occlusion.",
  "management": "Aspirin 325 mg + P2Y12 inhibitor...",
  "chapter_ref": "p06_c238"
}
```

All 8 clinical section fields are required; scripts do not validate this at runtime.

---

## 4. How to Run

Prerequisites: MongoDB running, `backend/.env` configured with `MONGO_URI`.

```bash
# From the project root
python backend/scripts/seed_questions.py
python backend/scripts/seed_cases.py
```

Each script prints a summary on completion:

```
Seed complete — 100 questions in dataset: 100 inserted, 0 already present.
Seed complete — 40 cases in dataset: 40 inserted, 0 already present.
```

Re-running is safe — already-present records are skipped:

```
Seed complete — 100 questions in dataset: 0 inserted, 100 already present.
```

Verify in `mongosh`:

```js
db.questions.countDocuments()  // → 100
db.cases.countDocuments()      // → 40
```

---

## 5. Files Changed

| File | What changed |
|------|-------------|
| `backend/scripts/seed_questions.py` | Extended the `QUESTIONS` list from 20 to 100 entries spanning 12 subspecialties. No logic changes; `seed()` and `main()` functions are unchanged. |
| `backend/scripts/seed_cases.py` | Extended the `CASES` list from 22 to 40 entries spanning 10 subspecialties. No logic changes; `seed()` and `main()` functions are unchanged. |

No other source files were modified. The frontend, API routes, and Pydantic schemas required no changes because they already consumed these collections generically.

---

## 6. Key Learnings

These were recorded during development of the broader CoreMD project and are relevant to understanding seeding decisions:

**MongoDB field naming:** Chapter documents store the identifier as `chapter_id`, not `id`. Any lookup or cross-reference (such as `chapter_ref` in questions and cases) must use this exact field name. Using `id` will silently return nothing.

**`chapter_ref` format comes from ingestion:** The `p{part:02d}_c{chapter:03d}` pattern is an output artifact of the PDF ingestion pipeline. Seed data authors must look up real chapter IDs from the `chapters` collection rather than guessing — an invalid `chapter_ref` will not raise an error at seed time but will produce broken links or failed lookups at runtime.

**Idempotency strategy matters:** A `find_one` + `insert_one` approach preserves manual edits to seeded documents. An `upsert` approach would be simpler to write but would silently overwrite production data on every deploy. The chosen strategy is slightly slower on first run but safer in practice.
