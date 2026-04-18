# PRD: Expanded Test Data

## Introduction

CoreMD currently has 20 MCQ questions across 6 topics and 22 clinical cases across
8 specialties. This is not enough to make the platform feel like a real learning tool —
residents would exhaust the question bank in minutes and see repetitive cases.

This PRD expands the seeded data to 100 questions and 40 cases, covering all major
internal medicine subspecialties represented in Harrison's, with realistic difficulty
distribution and high clinical quality.

## Goals

- Expand question bank from 20 → 100 questions
- Expand case library from 22 → 40 cases
- Cover all major Harrison subspecialties (Cardiology, Pulmonology, Nephrology,
  GI, Endocrinology, Neurology, Infectious Disease, Hematology, Rheumatology,
  Oncology, Dermatology, Psychiatry)
- Maintain realistic difficulty distribution: ~30% easy, ~50% medium, ~20% hard
- All questions must have correct answers, full explanations, and chapter references
- All cases must have complete clinical sections and realistic presentations

## User Stories

### US-001: Expand question bank to 100 questions
**Description:** As a resident, I want a large enough question bank that I can
practise without seeing the same questions repeatedly.

**Acceptance Criteria:**
- [x] `backend/scripts/seed_questions.py` updated to seed 100 total questions
- [x] Questions span at least 10 subspecialties: Cardiology, Pulmonology, Nephrology,
  Gastroenterology, Endocrinology, Neurology, Infectious Disease, Hematology,
  Rheumatology, Oncology, plus at least 2 others
- [x] Difficulty distribution: 28-32 easy, 45-55 medium, 18-22 hard
- [x] Each question has: question_id, topic, difficulty, question, 4 options (A-D),
  correct_option, explanation, chapter_ref pointing to a real chapter_id in MongoDB
- [x] Script is idempotent: running twice does not duplicate questions
- [x] After running, db.questions.countDocuments() returns 100
- [x] Typecheck passes

### US-002: Expand case library to 40 cases
**Description:** As a resident, I want enough clinical cases to practise diagnostic
reasoning across all major specialties.

**Acceptance Criteria:**
- [x] `backend/scripts/seed_cases.py` updated to seed 40 total cases
- [x] Cases span at least 10 subspecialties matching the question bank topics
- [x] Each case has all 8 required fields: presentation, history, physical_exam,
  labs, imaging, discussion, diagnosis, management
- [x] Each case has a chapter_ref pointing to a real chapter_id in MongoDB
- [x] Realistic clinical detail: vital signs, specific lab values, imaging findings
- [x] Script is idempotent: running twice does not duplicate cases
- [x] After running, db.cases.countDocuments() returns 40
- [x] Typecheck passes

## Non-Goals

- No AI-generated questions (all seeded manually in the script)
- No question categories beyond topic and difficulty
- No images or figures in questions or cases
- No user-facing import tool -- script only

## Technical Considerations

- Existing seed_questions.py uses a list of dicts + bulk upsert with question_id as key -- extend the same list
- Existing seed_cases.py uses the same pattern with case_id as key
- chapter_ref values must match real chapter_id values in MongoDB
- Keep existing 20 questions and 22 cases unchanged -- only add new ones
- Question IDs: continue from q021 onwards; case IDs: continue from case_023 onwards
