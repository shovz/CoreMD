# PRD: Stage B Oral Simulator (Exam Simulation)

## Introduction

Stage B Oral Simulator is a separate advanced assessment engine in CoreMD designed to
simulate the oral nature of Israeli Stage B examination.

Unlike current `Multi-step` chains, Stage B uses committee/station style progression,
adaptive probing on both correct and incorrect paths, and short-text reasoning evaluation
with AI rubric feedback.

## How It Works (Stage B Oral Pipeline)

1. User selects `Exam Simulation -> Stage B Oral`
2. Backend creates an oral session with station/committee sequence
3. Each station presents a clinical prompt and requires MCQ + short-text justification
4. System evaluates answer outcome and rationale quality (AI rubric)
5. Next probe is selected adaptively (correct and incorrect branches supported)
6. Station ends with domain-level summary (diagnosis/workup/management/safety/ethics)
7. User proceeds through all configured stations/committees
8. Final report aggregates competency map and top remediation priorities

## Goals

- Provide a separate Stage B-oriented oral simulator engine (not a Stage A variant)
- Evaluate reasoning depth, not only final option selection
- Add adaptive branch logic for both success and failure pathways
- Generate practical, concise feedback aligned to oral exam preparation

## User Stories

### US-001: Start Stage B oral session
**Description:** As a resident preparing for Stage B, I need a dedicated oral-style mode
that feels structurally different from standard MCQ sessions.

**Acceptance Criteria:**
- [ ] New launcher option: `Exam Simulation -> Stage B Oral`
- [ ] Stage B creates a dedicated oral session type (`exam_type=stage-b`)
- [ ] Session intro explains oral-station format and evaluation domains
- [ ] Stage B flow is isolated from Stage A runner logic

### US-002: Station/committee progression
**Description:** As a resident, I need to move through multiple oral stations that each
test clinical reasoning under time pressure.

**Acceptance Criteria:**
- [ ] Session contains configured station sequence
- [ ] Each station includes prompt(s), timing rules, and evaluation domains
- [ ] Station transition occurs only after completion/finalization of current station
- [ ] Station state persists across refresh/resume

### US-003: Adaptive probing logic
**Description:** As a resident, I want follow-up probes that adapt to my performance so
weak reasoning is challenged and corrected.

**Acceptance Criteria:**
- [ ] Branching supports both `correct` and `incorrect` transitions
- [ ] Probe selection respects station domain intent and branch path
- [ ] Branch history is persisted for report/audit
- [ ] Flow terminates safely at configured max probe depth

### US-004: AI rubric on short-text reasoning
**Description:** As a resident, I need structured feedback on my explanation quality, not
just whether I picked the right option.

**Acceptance Criteria:**
- [ ] Short-text justification is required for Stage B prompts (configurable)
- [ ] AI rubric returns normalized score + concise feedback
- [ ] Feedback includes key miss(es) and safety-critical omissions when present
- [ ] Rubric failure path degrades gracefully and does not corrupt session

### US-005: Stage B final competency report
**Description:** As a resident, I need a final oral-style report showing strengths and
priority remediation areas.

**Acceptance Criteria:**
- [ ] Report includes domain-level competency breakdown
- [ ] Report includes branch-derived risk flags (e.g., recurrent management errors)
- [ ] Report includes concise actionable next-step recommendations
- [ ] Report schema is stable for frontend rendering and history views

## Non-Goals

- No voice recording/transcription in v1
- No live examiner moderation tooling
- No official pass/fail determination equivalent to real board results
- No cross-user benchmarking leaderboard

## Technical Considerations

- Stage B must remain a separate engine from Stage A despite shared session infrastructure
- Adaptive graph can reuse `question_followups` concept but needs broader trigger semantics
  beyond current correct-only multi-step behavior
- AI rubric outputs should persist with `rubric_version` and `model_version`
- Strong guardrails required for prompt/output consistency and low-variance scoring behavior
- Hebrew oral context readiness should be supported in prompt/rubric configuration

### Suggested Station Data Shape (V1)

```json
{
  "station_id": "...",
  "domains": ["differential", "workup", "management", "safety", "ethics"],
  "prompts": [
    {
      "prompt_id": "...",
      "question_id": "...",
      "selected_option": 2,
      "rationale_text": "...",
      "mcq_result": "correct",
      "rubric_score": 0.72,
      "rubric_feedback": "...",
      "branch_to": "prompt_2"
    }
  ]
}
```

### Files to Create / Modify

| File | Action |
|---|---|
| `backend/app/api/v1/routes/questions.py` (or new route module) | Add Stage B oral session endpoints |
| `backend/app/schemas/` | Add Stage B station, rubric, and report schemas |
| `backend/app/services/` | Add adaptive oral engine + rubric orchestration |
| `frontend/src/pages/QuestionsPage.tsx` | Add Stage B launcher + station UI flow |
| `frontend/src/api/questionsApi.ts` | Add Stage B session API client methods |
| `backend/tests/test_questions.py` | Add Stage B adaptive/rubric/session tests |
| `frontend/tests/*.spec.ts` | Add Stage B oral journey E2E tests |
