# PRD: Stage A Mock Exam (Exam Simulation)

## Introduction

Stage A Mock Exam is a new advanced assessment mode in CoreMD designed to simulate
Israeli Stage A written exam conditions at full scale.

The mode runs as a fixed full-length exam with 150 questions over 4 hours, using a
configurable blueprint to balance topics and difficulty. It extends current question modes
(`By Topic`, `Random`, `Multi-step`) by testing endurance, pacing, and broad clinical
coverage in one unified session.

## How It Works (Stage A Simulation Pipeline)

1. User opens Question Bank and selects `Exam Simulation -> Stage A`
2. Backend creates an exam session with fixed defaults (150 questions, 240 minutes)
3. Question pool is assembled from the configured blueprint (topic/difficulty distribution)
4. User answers items sequentially (or via index navigation) under one global timer
5. Optional short-text rationale is captured per question (config-driven)
6. Submissions are persisted per item; duplicate/late submissions are rejected
7. Session auto-finalizes at timeout or finalizes manually when user completes
8. Report returns percent-correct score + topic/difficulty/pacing analytics

## Goals

- Deliver a high-fidelity Stage A practice mode (150Q/4h) inside existing Question Bank UX
- Add robust exam-session lifecycle APIs (create, answer, navigate, finalize, report)
- Use server-side blueprint configuration for maintainable exam composition
- Provide post-exam analytics that identify weak areas and pacing issues

## User Stories

### US-001: Launch Stage A simulation
**Description:** As a resident, I need to start a full Stage A mock quickly with clear
exam settings so I can practice in realistic conditions.

**Acceptance Criteria:**
- [ ] New launcher option: `Exam Simulation -> Stage A`
- [ ] Stage A displays fixed exam metadata: `150 questions`, `4 hours`
- [ ] Start action creates exactly one active Stage A session per user
- [ ] If an unfinished Stage A session exists, user can resume it

### US-002: Blueprint-based question assembly
**Description:** As a developer, I need server-side blueprint-driven selection so exam
composition can be tuned without frontend code changes.

**Acceptance Criteria:**
- [ ] Blueprint JSON config exists for Stage A (versioned)
- [ ] Selection applies topic weights and difficulty mix from config
- [ ] Deterministic fallback exists when a bucket has insufficient items
- [ ] Final assembled list contains 150 questions or a logged fallback state

### US-003: Timed exam runner
**Description:** As a resident, I need a global exam timer and stable answer persistence
so I can complete the session under pressure.

**Acceptance Criteria:**
- [ ] Global countdown starts at 14,400 seconds
- [ ] Timer state survives refresh/resume
- [ ] `POST answer` persists selected option (+ rationale when enabled)
- [ ] After timeout/finalize, no additional answers are accepted

### US-004: Stage A scoring and report
**Description:** As a resident, I need a clear final report to understand readiness and
knowledge gaps.

**Acceptance Criteria:**
- [ ] Primary score is `percent correct` (official score in v1)
- [ ] Report includes topic-level and difficulty-level breakdown
- [ ] Report includes pacing metrics (time spent / unanswered count)
- [ ] Report endpoint returns stable schema for frontend rendering

### US-005: Optional rationale feedback
**Description:** As a resident, I want optional rationale capture and feedback to improve
clinical reasoning beyond MCQ selection.

**Acceptance Criteria:**
- [ ] Rationale input can be enabled/required by Stage A config
- [ ] Rationale text is stored per item submission
- [ ] AI feedback (when enabled) is supplemental, not primary score in v1
- [ ] Failure in AI feedback path does not block exam completion

## Non-Goals

- No IRT/psychometric scoring in v1
- No official certification/equivalence claims
- No educator-admin authoring UI for blueprint editing
- No audio/voice interaction

## Technical Considerations

- Stage A defaults are fixed: `question_count=150`, `duration_seconds=14400`
- Keep primary score policy as percent-correct only (per product decision)
- Blueprint stored server-side as JSON with explicit `version`
- Session consistency requires server-authoritative time checks on each submission
- Existing modes (`topic`, `random`, `multi-step`, `cases`) must remain unchanged
- Rationale feedback path should be asynchronous/fault-tolerant to avoid blocking core flow

### Suggested Session Data Shape (V1)

```json
{
  "session_id": "...",
  "user_id": "...",
  "exam_type": "stage-a",
  "status": "active|finalized|expired",
  "blueprint_version": "stage-a-v1",
  "started_at": "...",
  "expires_at": "...",
  "finalized_at": null,
  "items": [
    {
      "index": 1,
      "question_id": "q_...",
      "selected_option": null,
      "rationale_text": null,
      "is_correct": null,
      "answered_at": null
    }
  ]
}
```

### Files to Create / Modify

| File | Action |
|---|---|
| `backend/app/api/v1/routes/questions.py` | Add Stage A exam-session endpoints |
| `backend/app/schemas/question.py` (or new `exam.py`) | Add Stage A session/request/response schemas |
| `backend/app/services/` | Add Stage A assembly/scoring service |
| `frontend/src/pages/QuestionsPage.tsx` | Add Stage A launcher + runner UI flow |
| `frontend/src/api/questionsApi.ts` | Add Stage A exam session API client methods |
| `backend/tests/test_questions.py` | Add Stage A session, timer, scoring tests |
| `frontend/tests/*.spec.ts` | Add Stage A end-to-end flow tests |
