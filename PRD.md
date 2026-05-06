# PRD: Stage B Oral Exam Simulator

## Introduction

Internal medicine residents preparing for the IMA Stage B specialist oral exam need to practice the rolling case scenario (תרחיש מתגלגל) format. Unlike Stage A (MCQ), Stage B is a live clinical viva where an examiner presents a case in five progressive stages — each revealing new clinical information — and the candidate must reason aloud through differential diagnosis, workup, management, and complications.

CoreMD simulates this experience: GPT-4o generates a complete rolling case scenario per selected topic, each stage is read aloud via TTS, and the resident answers either by typing or recording their voice. AI grades every response against a model answer and returns examiner-style feedback.

## Goals

- GPT-4o generates a clinically coherent 5-stage rolling case (Presentation → Workup → Complication → Ward Management → Discharge) per selected topic
- Each stage's clinical revelation is delivered via OpenAI TTS audio before the questions appear
- Resident answers by typing or recording audio (Whisper transcribes recording to editable text)
- AI grades every answer immediately: score 0–10, examiner feedback, key points covered/missed, model answer revealed
- Session = 2–3 cases; overall report shows per-case and per-topic performance

## User Stories

### US-001: Backend — case generation service
**Description:** As a developer, I need a service that calls GPT-4o to generate a structured rolling case scenario so the exam simulator has clinically valid content.

**Acceptance Criteria:**
- [x] New file `backend/app/services/case_generation_service.py`
- [x] `generate_rolling_case(client: OpenAI, topic: str, difficulty: str) -> dict` — calls `gpt-4o` with a system prompt that defines the 5-stage rolling case JSON schema
- [x] Returned dict has keys: `case_id`, `topic`, `patient_summary`, `stages[]`
- [x] Each stage has: `stage_num`, `title`, `revelation`, `questions[]`
- [x] Each question has: `question_num`, `text`, `type`, `model_answer`, `key_points[]`
- [x] Retries once on JSON parse failure; raises `HTTPException 502` if both attempts fail
- [x] At session start, cases generated in parallel via `asyncio.gather`

### US-002: Backend — audio service
**Description:** As a developer, I need TTS and STT functions so questions are delivered as audio and voice recordings are transcribed.

**Acceptance Criteria:**
- [x] New file `backend/app/services/audio_service.py`
- [x] `get_or_generate_tts(client, redis, cache_key, text, voice) -> bytes` — calls `openai.audio.speech.create(model="tts-1")`, caches MP3 as base64 string in Redis (TTL 86400s); returns raw bytes on hit
- [x] Cache key format: `tts:{session_id}:{case_idx}:{stage_idx}`
- [x] Base64 encoding used because existing Redis client has `decode_responses=True`
- [x] `transcribe_audio(client, audio_bytes, filename) -> str` — calls Whisper (`whisper-1`); validates `len(audio_bytes) <= 25 * 1024 * 1024`; raises `HTTPException 422` if transcript empty
- [x] `build_stage_tts_text(stage_num, title, revelation, questions) -> str` — constructs the full spoken text for one stage

### US-003: Backend — grading service
**Description:** As a developer, I need a grading function that evaluates a resident's oral answer against a model answer so each response receives a score and examiner feedback.

**Acceptance Criteria:**
- [x] New file `backend/app/services/grading_service.py`
- [x] `grade_oral_answer(client, question_text, model_answer, key_points, student_answer) -> GradingResult`
- [x] `GradingResult` TypedDict: `score: int` (0–10), `passed: bool` (≥6), `feedback: str`, `key_points_covered: list[str]`, `key_points_missed: list[str]`
- [x] Uses `gpt-4o-mini`; system prompt instructs examiner role; returns JSON with no markdown fences
- [x] Retries once on parse failure; raises `HTTPException 502` on both failures

### US-004: Backend — Stage B schemas
**Description:** As a developer, I need Pydantic schemas for all Stage B request/response types.

**Acceptance Criteria:**
- [x] New file `backend/app/schemas/stage_b.py`
- [x] `StageBStartRequest`: `topics: List[str]`, `case_count: int` (1–3, default 2), `duration_minutes: int` (30–90, default 45), `difficulty: str` (easy/medium/hard), `voice: str` (default "alloy")
- [x] `StageBQuestion`: all question fields including grading result fields (nullable until answered); `model_answer` and `key_points` are stored server-side but excluded from session GET response
- [x] `StageBStage`, `StageBCase`, `StageBSessionOut` — session response with `current_case_idx`, `current_stage_idx`
- [x] `StageBAnswerCreate`: `student_answer: str` (max 5000), `answer_mode: str` ("text"/"audio")
- [x] `StageBAnswerResult`: grading result + `model_answer` (revealed after grading) + `remaining_seconds` + `all_stage_questions_answered: bool`
- [x] `StageBReportOut`: overall stats + per-case breakdown with full stage/question data including model answers

### US-005: Backend — Stage B routes
**Description:** As a developer, I need REST endpoints for the Stage B exam session lifecycle.

**Acceptance Criteria:**
- [x] New file `backend/app/api/v1/routes/stage_b.py`; registered in `backend/app/main.py` with prefix `/api/v1/stage-b`
- [x] `POST /sessions/start` — validates no active stage-b session; generates `case_count` cases in parallel; stores full cases (with `model_answer` + `key_points`) in `stage_b_sessions` collection; returns `StageBSessionOut` with `model_answer`/`key_points` stripped
- [x] `GET /sessions/active` — returns active session for current user; `model_answer`/`key_points` stripped; 404 if none
- [x] `POST /sessions/{id}/tts/{case_idx}/{stage_idx}` — returns `Response(content=mp3_bytes, media_type="audio/mpeg")`; uses `get_or_generate_tts`; validates session active + indices in range
- [x] `POST /sessions/{id}/transcribe/{case_idx}/{stage_idx}/{question_num}` — accepts `audio_file: UploadFile` (multipart); returns `{"transcription": str}`; does NOT write to DB
- [x] `POST /sessions/{id}/answer/{case_idx}/{stage_idx}/{question_num}` — body `StageBAnswerCreate`; rejects if question already answered; calls `grade_oral_answer`; writes result + `answered_at` to DB; returns `StageBAnswerResult`
- [x] `POST /sessions/{id}/advance-stage` — validates all questions in `current_stage_idx` answered; increments `current_stage_idx` (or `current_case_idx` if last stage); returns updated `StageBSessionOut`
- [x] `POST /sessions/{id}/finalize` — computes report; sets status `"finalized"`; returns `StageBReportOut`
- [x] `GET /sessions/{id}/report` — returns `StageBReportOut`; only available on finalized sessions
- [x] All endpoints require `current_user` dependency

### US-006: Frontend — API client
**Description:** As a developer, I need a typed API client for all Stage B endpoints.

**Acceptance Criteria:**
- [x] New file `frontend/src/api/stageBApi.ts`
- [x] Full TypeScript interfaces for `StageBSession`, `StageBCase`, `StageBStage`, `StageBQuestion`, `StageBAnswerResult`, `StageBReport`
- [x] `startStageBSession(payload)`, `getActiveStageBSession()`, `finalizeStageBSession(id)`, `getStageBReport(id)`
- [x] `fetchStageBTts(sessionId, caseIdx, stageIdx) -> Promise<string>` — uses `fetch()` with `Authorization: Bearer` header (browser audio element cannot send custom headers); converts response to blob; returns `URL.createObjectURL(blob)`
- [x] `transcribeStageBRecording(sessionId, caseIdx, stageIdx, questionNum, audioBlob)` — sends `FormData` with `audio_file` field
- [x] `submitStageBAnswer(sessionId, caseIdx, stageIdx, questionNum, payload)`
- [x] `advanceStage(sessionId)`
- [x] TypeScript check passes

### US-007: Frontend — useAudioRecorder hook
**Description:** As a developer, I need a hook that wraps the MediaRecorder API so recording logic is reusable.

**Acceptance Criteria:**
- [x] New file `frontend/src/hooks/useAudioRecorder.ts`
- [x] Returns `{ state, audioBlob, audioUrl, durationSeconds, startRecording, stopRecording, reset, error }`
- [x] `state`: `"idle" | "recording" | "stopped"`
- [x] Uses `navigator.mediaDevices.getUserMedia({ audio: true })`
- [x] MIME type: `audio/webm;codecs=opus` with `MediaRecorder.isTypeSupported` check; fallback `audio/mp4` (Safari)
- [x] Auto-stops after `maxDurationSeconds` (default 120)
- [x] `audioUrl` is an object URL (`URL.createObjectURL`); previous URL revoked on each new recording
- [x] `reset()` clears blob, URL, reverts to `"idle"`
- [x] `error` set to user-readable string if `getUserMedia` is denied

### US-008: Frontend — AudioPlayer component
**Description:** As a resident, I need a custom audio player so I can play, pause, and replay the stage revelation without relying on the default browser audio control.

**Acceptance Criteria:**
- [x] New file `frontend/src/components/AudioPlayer.tsx`
- [x] Props: `{ src: string; label?: string; autoPlay?: boolean; className?: string }`
- [x] Renders a custom play/pause button, progress bar, and elapsed/total time display over a hidden `<audio>` element via `useRef`
- [x] `autoPlay` triggers playback once `src` is set
- [x] Typecheck passes

### US-009: Frontend — AudioRecorder component
**Description:** As a resident, I need a recording UI so I can answer questions by speaking instead of typing.

**Acceptance Criteria:**
- [ ] New file `frontend/src/components/AudioRecorder.tsx`
- [ ] Props: `{ onRecordingComplete: (blob: Blob) => void; disabled?: boolean; maxSeconds?: number }`
- [ ] Uses `useAudioRecorder` hook
- [ ] Shows: microphone button (toggles recording), live duration counter during recording, simple CSS animation indicating active recording
- [ ] After stop: shows playback preview via `AudioPlayer` + "Use This Recording" confirm button
- [ ] Calls `onRecordingComplete(blob)` when confirmed
- [ ] Shows readable error string if microphone permission denied
- [ ] Typecheck passes

### US-010: Frontend — StageBExamPage — settings phase
**Description:** As a resident preparing for Stage B, I want to configure an oral exam session so I can practise the case scenario format.

**Acceptance Criteria:**
- [ ] New file `frontend/src/pages/StageBExamPage.tsx`
- [ ] Settings phase UI: topic multi-select (same topic list used by Stage A), case count radio (1/2/3, default 2), duration selector (30/45/60/90 min), difficulty selector (Easy/Medium/Hard), voice dropdown (alloy/echo/fable/onyx/nova/shimmer)
- [ ] "Generate Exam" button calls `startStageBSession`; shows loading state with message "Generating cases…" during the GPT-4o call (~5–10s)
- [ ] "Resume Active Session" button appears if `getActiveStageBSession` returns a result; clicking it loads the active session directly into running phase
- [ ] Typecheck passes

### US-011: Frontend — StageBExamPage — running phase
**Description:** As a resident, I want to work through each stage of the rolling case so I can practise clinical reasoning in a realistic oral exam format.

**Acceptance Criteria:**
- [ ] Running phase layout: left sidebar = case/stage navigator; main area = current stage content
- [ ] Case/stage navigator shows all cases and their stages with status indicators (unanswered / in-progress / complete); future cases are locked until the previous case is fully completed
- [ ] Timer countdown displayed in top-right; auto-finalizes session on expiry
- [ ] Per-stage main area flow:
  - Stage title badge and patient context line
  - `AudioPlayer` — TTS fetched via `fetchStageBTts` on stage load; auto-plays; revelation text hidden until audio finishes or user clicks "Show Text"
  - Questions appear in sequence below the audio player; each question shows after the previous is answered
  - Per question: question text, answer mode tabs ("Type" / "Record"), answer input, "Submit Answer" button
  - Text mode: `<textarea>` max 3000 chars
  - Audio mode: `<AudioRecorder>` → on complete calls `transcribeStageBRecording` → editable transcript textarea
  - Submit calls `submitStageBAnswer`; inline result displayed: score badge (colour-coded), examiner feedback, key points covered/missed, model answer
  - After all questions in stage answered: "Next Stage →" button (calls `advanceStage`)
- [ ] Previous TTS object URLs revoked when stage changes (memory cleanup)
- [ ] `setExamRunning(phase === "running")` wired to existing exam guard (same pattern as ExamsPage.tsx)
- [ ] Typecheck passes; verify full flow works in browser

### US-012: Frontend — StageBExamPage — review phase
**Description:** As a resident, I want to review my performance after completing a Stage B session so I can identify my weak areas.

**Acceptance Criteria:**
- [ ] Review phase shows overall stats: total questions answered, pass count, average score (0–10)
- [ ] Per-case accordion: case topic + patient summary header; expandable per-stage sections
- [ ] Per stage: revelation text, then per question: student answer, model answer, score badge, AI feedback, key points covered/missed
- [ ] "Back to Exams" button navigates to `/exams`
- [ ] Typecheck passes

### US-013: Frontend — routing and navigation
**Description:** As a resident, I need Stage B accessible from the sidebar and a protected route so I can navigate to it.

**Acceptance Criteria:**
- [ ] `frontend/src/router.tsx`: protected route `/exams/stage-b` → `StageBExamPage`
- [ ] `frontend/src/components/Sidebar.tsx`: "Stage B Oral" nav entry beneath the "Exams" entry; uses a microphone SVG icon consistent in style with existing nav icons
- [ ] Typecheck passes

## Non-Goals

- No preset saving for Stage B (unlike Stage A — case generation is fast enough to reconfigure each time)
- No exam pause/resume mid-stage (resume resumes at the current stage, not mid-question)
- No video recording — audio only
- No human examiner mode (async review by an attending)
- No Hindi/Arabic/non-English case generation for MVP (English cases only)
- No difficulty blueprint per stage (difficulty applies to the whole case)

## Technical Considerations

- **Parallel case generation:** `asyncio.gather(*[generate_rolling_case(...) for _ in range(case_count)])` — 2 cases generate concurrently, approximately 5–8 seconds total
- **model_answer security:** stored in MongoDB but excluded from all GET session responses via a dedicated serialization function; only returned inside `StageBAnswerResult` after the student submits
- **Redis base64 constraint:** the existing Redis client is initialised with `decode_responses=True` which prevents storing raw bytes; TTS MP3 must be base64-encoded before `redis.setex()` and decoded after `redis.get()`
- **TTS auth:** the TTS endpoint requires a JWT Bearer token; the browser's `<audio src="">` element cannot send custom headers; frontend must use `fetch()` with the Authorization header, convert the response to a Blob, and pass a `URL.createObjectURL` URL to `AudioPlayer`
- **Stage B sessions collection:** use a separate `stage_b_sessions` MongoDB collection (not `exam_sessions`) to keep Stage A and Stage B schemas fully independent
- **Advance-stage backend guard:** `POST /advance-stage` checks that every question in `current_stage_idx` has a non-null `answered_at` before incrementing; prevents accidental skipping
- **Exam guard:** existing `AppShell` navigation guard applies to Stage B running phase via `setExamRunning` — no additional guard wiring needed
