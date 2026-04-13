# PRD: Case Studies

## Introduction

Case studies are a core learning tool for internal medicine residents. Each case presents
a real-world clinical scenario with history, physical exam, labs, imaging, discussion,
diagnosis, and management — all structured sections shown at once for educational reading.
A hidden "Show Hint" button reveals the related Harrison's chapter for residents who want
a reference without spoiling their own thinking first.

The backend cases route is currently a stub. This PRD seeds 20+ cases into MongoDB,
builds the listing and detail API, and creates the full frontend viewer.

## Goals

- Seed 20–25 clinical case documents into MongoDB across major specialties
- Expose a listing API (with specialty filter) and a detail API
- Build a cases browse page with specialty filtering
- Build a case detail page showing all structured sections
- Hidden chapter hint: chapter reference shown only when resident clicks "Show Hint"

## User Stories

### US-001: Case schema and seed script
**Description:** As a developer, I need case documents in MongoDB with realistic clinical
content so the API and frontend have real data to work with.

**Acceptance Criteria:**
- [x] `backend/scripts/seed_cases.py` created with 20–25 cases spanning at least 8 specialties (Cardiology, Pulmonology, Nephrology, Gastroenterology, Endocrinology, Neurology, Infectious Disease, Hematology)
- [x] Each case document contains: `case_id` (str), `title` (str), `specialty` (str), `presentation` (str), `history` (str), `physical_exam` (str), `labs` (str), `imaging` (str), `discussion` (str), `diagnosis` (str), `management` (str), `chapter_ref` (str, matching a real `chapter_id` in `chapters` collection)
- [x] `backend/app/schemas/case.py` created with `CaseOut` (all fields) and `CaseListItem` (case_id, title, specialty only — for listing)
- [x] Script is idempotent: unique index on `case_id`, skips already-inserted docs
- [x] Running `python backend/scripts/seed_cases.py` prints inserted count
- [x] Typecheck passes

### US-002: Cases listing and detail API
**Description:** As a developer, I need API endpoints to list and retrieve cases so the
frontend can display them.

**Acceptance Criteria:**
- [ ] `GET /cases/` returns list of `CaseListItem` (case_id, title, specialty) — all cases, no pagination needed for MVP
- [ ] Supports optional query param `specialty` (str) to filter by specialty
- [ ] `GET /cases/{case_id}` returns full `CaseOut` document including all sections
- [ ] Returns 404 if `case_id` not found
- [ ] Both routes require valid JWT
- [ ] Existing stub in `backend/app/api/v1/routes/cases.py` replaced (not a new file)
- [ ] Typecheck passes

### US-003: Cases list page
**Description:** As a resident, I want to browse available cases filtered by specialty
so I can choose what to study.

**Acceptance Criteria:**
- [ ] `frontend/src/pages/CasesPage.tsx` created
- [ ] Fetches `GET /cases/` on load, displays list of cases
- [ ] Each case shown as a card with: title, specialty badge, "View Case" button
- [ ] Specialty filter dropdown (populated from unique specialties in the fetched list)
- [ ] Filters cases client-side when specialty selected
- [ ] Loading and error states handled
- [ ] Route `/cases` added to `frontend/src/router.tsx`
- [ ] Link to Cases page added to Home page navigation
- [ ] `frontend/src/api/casesApi.ts` created with `getCases(specialty?)` and `getCaseById(id)`
- [ ] Typecheck passes
- [ ] Verify changes work in browser

### US-004: Case detail page
**Description:** As a resident, I want to read a full clinical case with all structured
sections, and optionally reveal the related Harrison's chapter as a hint.

**Acceptance Criteria:**
- [ ] `frontend/src/pages/CaseDetailPage.tsx` created
- [ ] Route `/cases/:id` added to `frontend/src/router.tsx`
- [ ] Fetches `GET /cases/{case_id}` and displays all sections in order: Presentation, History, Physical Exam, Labs, Imaging, Discussion, Diagnosis, Management
- [ ] Each section rendered as a labelled block with a bold heading and paragraph text
- [ ] "Show Hint" button at the bottom of the page — hidden by default
- [ ] Clicking "Show Hint" reveals: "Reference: [chapter title] — [chapter_ref]" (toggle: clicking again hides it)
- [ ] "Back to Cases" link at the top
- [ ] Loading and error states handled
- [ ] Typecheck passes
- [ ] Verify changes work in browser

## Non-Goals

- No user progress tracking for cases (no "mark as read" or completion state)
- No case search by keyword
- No case comments or annotations
- No AI-generated cases (manual seed only)
- No pagination (20–25 cases fit comfortably in one list)
- No case difficulty rating

## Technical Considerations

- `case_id` format: `case_{specialty_slug}_{index:03d}` (e.g. `case_cardiology_001`) for stable idempotent re-seeding
- `chapter_ref` must match a real `chapter_id` from the `chapters` collection (e.g. `p06_c238`) — seed script should use valid IDs from the ingested data
- The hint button should use a simple `useState(false)` toggle — no URL state needed
- Reuse existing `apiClient.ts` Axios instance in `casesApi.ts`
- The cases route file already exists at `backend/app/api/v1/routes/cases.py` — replace the stub in place
- `main.py` already registers the cases router — no change needed there

### MongoDB Document Shape

```json
{
  "case_id": "case_cardiology_001",
  "title": "Acute STEMI in a 58-Year-Old Diabetic Man",
  "specialty": "Cardiology",
  "presentation": "A 58-year-old man with a history of type 2 diabetes and hypertension presents to the ED with 2 hours of crushing substernal chest pain radiating to his left arm, accompanied by diaphoresis and nausea.",
  "history": "Past medical history: T2DM (10 years), hypertension, hyperlipidemia. Medications: metformin, lisinopril, atorvastatin. Family history: father died of MI at 62. Social: 20 pack-year smoking history, quit 5 years ago.",
  "physical_exam": "BP 155/95, HR 102, RR 18, SpO2 96% on room air. Diaphoretic. JVP not elevated. Heart: regular rhythm, no murmurs. Lungs: clear. Extremities: no edema.",
  "labs": "Troponin I: 4.2 ng/mL (elevated). BMP: glucose 210, Cr 1.1, K 4.2. CBC: WBC 11.2, Hgb 13.8. Coagulation: normal.",
  "imaging": "ECG: ST elevations in leads II, III, aVF with reciprocal changes in I and aVL — consistent with inferior STEMI. CXR: no pulmonary edema, normal cardiac silhouette.",
  "discussion": "Inferior STEMI is most commonly caused by occlusion of the right coronary artery (RCA). Diabetic patients may present with atypical symptoms. Rapid reperfusion via primary PCI within 90 minutes of first medical contact is the standard of care.",
  "diagnosis": "Inferior ST-elevation myocardial infarction (STEMI) due to acute RCA occlusion.",
  "management": "Aspirin 325 mg + P2Y12 inhibitor (ticagrelor or clopidogrel). Activate cath lab for primary PCI. IV heparin. Beta-blocker if hemodynamically stable. Statin therapy. Post-PCI: dual antiplatelet therapy for 12 months.",
  "chapter_ref": "p06_c238"
}
```

### Files to Create / Modify

| File | Action |
|---|---|
| `backend/scripts/seed_cases.py` | Create |
| `backend/app/schemas/case.py` | Create |
| `backend/app/api/v1/routes/cases.py` | Replace stub |
| `frontend/src/api/casesApi.ts` | Create |
| `frontend/src/pages/CasesPage.tsx` | Create |
| `frontend/src/pages/CaseDetailPage.tsx` | Create |
| `frontend/src/router.tsx` | Add /cases and /cases/:id routes |
