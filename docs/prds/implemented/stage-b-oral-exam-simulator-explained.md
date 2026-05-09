# Stage B Oral Exam Simulator — Implementation Explained

## 1. What Was Implemented and Why

The IMA Stage B specialist oral exam uses a "rolling case scenario" (תרחיש מתגלגל) format. Unlike Stage A (MCQs), Stage B is a live clinical viva: an examiner walks the candidate through five progressive stages of a patient encounter and expects verbal reasoning on differential diagnosis, workup, management, and complications.

CoreMD's Stage B simulator replicates this experience in the browser:
- GPT-4o generates a clinically coherent 5-stage rolling case per selected topic.
- Each stage revelation is read aloud via OpenAI TTS before questions appear.
- The resident answers by typing or recording audio (Whisper transcribes voice input to editable text).
- GPT-4o-mini grades every answer immediately and returns an examiner-style score, feedback, and model answer reveal.

All 13 user stories are complete. This document covers the full implementation: backend services, Pydantic schemas, REST routes, the typed frontend API client, audio hooks and components, the three-phase exam page, and routing/navigation wiring.

| Story | Scope | Status |
|---|---|---|
| US-001 | `case_generation_service.py` — GPT-4o rolling case generator | ✅ Done |
| US-002 | `audio_service.py` — TTS (cached), STT (Whisper), stage text builder | ✅ Done |
| US-003 | `grading_service.py` — GPT-4o-mini oral answer grader | ✅ Done |
| US-004 | `schemas/stage_b.py` — full Pydantic schema set for Stage B lifecycle | ✅ Done |
| US-005 | `api/v1/routes/stage_b.py` — REST endpoints; registered in `main.py` | ✅ Done |
| US-006 | `frontend/src/api/stageBApi.ts` — typed frontend API client | ✅ Done |
| US-007 | `frontend/src/hooks/useAudioRecorder.ts` — MediaRecorder hook | ✅ Done |
| US-008 | `frontend/src/components/AudioPlayer.tsx` — custom audio player | ✅ Done |
| US-009 | `frontend/src/components/AudioRecorder.tsx` — recording UI component | ✅ Done |
| US-010 | `StageBExamPage` — settings phase | ✅ Done |
| US-011 | `StageBExamPage` — running phase | ✅ Done |
| US-012 | `StageBExamPage` — review phase | ✅ Done |
| US-013 | Router entry + sidebar nav | ✅ Done |

---

## 2. Key Design Decisions

### GPT-4o for generation, GPT-4o-mini for grading
Case generation requires clinical coherence and structured JSON output across 5 stages — `gpt-4o` is used because quality matters and generation happens once per session. Grading is called per answer (up to ~15 times per session) and follows a narrow, deterministic schema, making `gpt-4o-mini` adequate and significantly cheaper.

### Retry-once pattern instead of full retry loop
Both `generate_rolling_case` and `grade_oral_answer` attempt the GPT call twice on JSON parse/key error, then raise `HTTPException 502`. A longer retry loop would mask a systemic prompt bug and inflate latency. Two attempts handle transient malformed output without hiding real failures.

### `response_format={"type": "json_object"}` on generation
The case generation prompt uses OpenAI's JSON mode to guarantee parseable output. A `case_id` UUID is injected server-side if the model omits it, making the generated case safe to insert into MongoDB immediately.

### `ThreadPoolExecutor` for parallel case generation (not `asyncio.gather`)
`generate_rolling_case` is a synchronous OpenAI call. Running it with `asyncio.gather` would block the event loop. The routes use `ThreadPoolExecutor` to run multiple sync calls concurrently; `future_to_idx` mapping preserves case order when collecting results from `as_completed`.

### Redis base64 constraint for TTS caching
The Redis client is initialised with `decode_responses=True` globally. This prevents storing raw bytes. TTS MP3 audio is base64-encoded before `redis.setex()` and decoded with `base64.b64decode()` on cache hit. TTL is 86400s (24 hours). This is a project-wide constraint — any service that caches binary data must follow the same pattern.

### TTS cache key format: `tts:{session_id}:{case_idx}:{stage_idx}`
One cache entry per stage per session. Stages are not shared across sessions because GPT generates different cases each time. Caching prevents re-calling the TTS API when a resident replays audio for the same stage.

### `"stem"` → `"text"` key transform before calling `build_stage_tts_text`
Questions stored in MongoDB use the key `"stem"` for the question text (consistent with the Stage A question schema). `build_stage_tts_text` expects `"text"`. The route transforms question lists inline: `[{"text": q["stem"]} for q in stage["questions"]]` before calling the helper. Both dict and Pydantic model input shapes are handled via an `isinstance(q, dict)` branch.

### `model_answer` and `key_points` excluded from session GET, revealed only on answer submit
Enforced at the schema layer: `StageBQuestion` (used in `StageBSessionOut`) omits these fields. `StageBQuestionFull` (used in `StageBReportOut`) includes them. `StageBAnswerResult` returns `model_answer` only after grading. The data is simply absent from the wire until the student submits — no client-side workaround can expose it early.

### Separate `stage_b_sessions` MongoDB collection
Stage B and Stage A sessions have fundamentally different shapes (rolling cases vs. flat question lists). A dedicated collection keeps schemas independent, avoids null-heavy documents, and allows independent indexing and TTL cleanup in the future.

### `grading_service` uses `temperature=0`
Grading must be deterministic. A student re-submitting the same answer should get the same score. `temperature=0` removes stochastic variation.

### TTS fetch via `fetch()` + Blob, not `<audio src="...">`
The TTS endpoint requires JWT authentication. The browser's `<audio src="...">` element cannot send custom headers. `fetchStageBTts` uses `fetch()` with the `Authorization: Bearer` header, converts the MP3 response to a Blob, and returns a `URL.createObjectURL(blob)` that `AudioPlayer` can use as its `src`.

### `python-multipart` is a required dependency for `UploadFile` routes
FastAPI does not install `python-multipart` by default. The `/transcribe` endpoint uses `UploadFile` (multipart form upload), which silently fails without this package. It must be present in `requirements.txt`.

---

## 3. MongoDB Document Shape

### `stage_b_sessions` collection

One document per exam session, written by `POST /sessions/start`.

```json
{
  "_id": "<ObjectId>",
  "session_id": "<uuid string>",
  "user_id": "<ObjectId>",
  "exam_type": "stage-b",
  "status": "active | finalized",
  "difficulty": "easy | medium | hard",
  "voice": "alloy",
  "case_count": 2,
  "duration_minutes": 45,
  "started_at": "<ISODate>",
  "expires_at": "<ISODate>",
  "finalized_at": null,
  "current_case_idx": 0,
  "current_stage_idx": 0,
  "cases": [
    {
      "case_index": 0,
      "case_id": "<uuid>",
      "title": "<case title>",
      "chief_complaint": "<chief complaint>",
      "stages": [
        {
          "stage_index": 0,
          "title": "Presentation",
          "context": "<clinical revelation text>",
          "questions": [
            {
              "question_id": "<uuid>",
              "stage_index": 0,
              "stem": "<question text>",
              "topic": "<topic>",
              "difficulty": "medium",
              "model_answer": "<correct answer — excluded from GET responses>",
              "key_points": ["<point1>", "<point2>"],
              "student_answer": null,
              "answer_mode": null,
              "score": null,
              "feedback": null,
              "key_points_hit": null,
              "answered_at": null
            }
          ]
        }
      ]
    }
  ]
}
```

**Note:** `model_answer` and `key_points` are stored in the document but stripped from `StageBSessionOut` via `_session_to_out`. Only `StageBReportOut` and `StageBAnswerResult` expose these fields.

---

## 4. How to Run

### Prerequisites

`backend/.env` must include:
```
OPENAI_API_KEY=sk-...
REDIS_URL=redis://localhost:6379
MONGO_URI=mongodb://localhost:27017/CoreMD
```

`python-multipart` must be in `backend/requirements.txt` (required by the `/transcribe` endpoint).

### Start the backend

```bash
cd backend
python -m uvicorn app.main:app --reload
```

Stage B routes are registered at `/api/v1/stage-b`. All endpoints require a valid JWT bearer token.

### Key endpoints

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/v1/stage-b/sessions/start` | Generate cases and create session |
| `GET` | `/api/v1/stage-b/sessions/active` | Resume an active session |
| `POST` | `/api/v1/stage-b/sessions/{id}/tts/{case}/{stage}` | Get MP3 audio for a stage |
| `POST` | `/api/v1/stage-b/sessions/{id}/transcribe/{case}/{stage}/{q}` | Transcribe voice recording |
| `POST` | `/api/v1/stage-b/sessions/{id}/answer/{case}/{stage}/{q}` | Submit answer, get grading |
| `POST` | `/api/v1/stage-b/sessions/{id}/advance-stage` | Move to next stage |
| `POST` | `/api/v1/stage-b/sessions/{id}/finalize` | End session, compute report |
| `GET` | `/api/v1/stage-b/sessions/{id}/report` | Retrieve finalized report |

### Test services in isolation

```python
from openai import OpenAI
from app.services.case_generation_service import generate_rolling_case
from app.services.grading_service import grade_oral_answer

client = OpenAI()  # reads OPENAI_API_KEY from env
case = generate_rolling_case(client, topic="heart failure", difficulty="medium")
result = grade_oral_answer(
    client,
    question_text="What is the first-line treatment?",
    model_answer="Furosemide IV for acute decompensation...",
    key_points=["Diuresis", "Fluid restriction"],
    student_answer="Give IV furosemide and restrict fluids",
)
```

---

## 5. Files Changed

### New backend files

| File | What it does |
|---|---|
| `backend/app/services/case_generation_service.py` | Calls `gpt-4o` with a structured JSON schema prompt to produce a 5-stage rolling case dict. Retries once on parse failure; raises 502 on second failure. Injects a `case_id` UUID if the model omits it. |
| `backend/app/services/audio_service.py` | Three functions: `get_or_generate_tts` (calls `tts-1`, caches base64 MP3 in Redis for 24h), `transcribe_audio` (calls `whisper-1`, validates 25MB limit and non-empty transcript), `build_stage_tts_text` (assembles stage title + revelation + question texts into a single spoken string). |
| `backend/app/services/grading_service.py` | Calls `gpt-4o-mini` at `temperature=0` to score a student's oral answer 0–10 against a model answer and key points. Returns `GradingResult` TypedDict. Retries once on parse failure; raises 502 on second failure. |
| `backend/app/schemas/stage_b.py` | Full Pydantic schema set: `StageBStartRequest`, `StageBQuestion` (session view — no model answer), `StageBQuestionFull` (report view — includes model answer), `StageBStage`, `StageBCase`, `StageBSessionOut`, `StageBAnswerCreate`, `StageBAnswerResult`, `StageBStageReport`, `StageBCaseReport`, `StageBReportOut`. |
| `backend/app/api/v1/routes/stage_b.py` | All Stage B REST endpoints (8 routes). Validates session ownership and state on every call. Uses `ThreadPoolExecutor` for parallel case generation. Strips `model_answer`/`key_points` from session GET responses via `_session_to_out`. Enforces all-questions-answered guard before `advance-stage`. |

### Modified backend files

| File | What changed |
|---|---|
| `backend/app/main.py` | Imports and registers the Stage B router with prefix `/api/v1/stage-b`. |

### New frontend files

| File | What it does |
|---|---|
| `frontend/src/api/stageBApi.ts` | Typed API client for all Stage B endpoints. `fetchStageBTts` uses `fetch()` + `URL.createObjectURL` (not `<audio src>`) to handle the JWT-protected TTS endpoint. `transcribeStageBRecording` sends `FormData` with `audio_file` field. All other calls go through the shared axios `apiClient`. |
| `frontend/src/hooks/useAudioRecorder.ts` | Wraps `MediaRecorder`. Returns `{ state, audioBlob, audioUrl, durationSeconds, startRecording, stopRecording, reset, error }`. MIME type prefers `audio/webm;codecs=opus` with `audio/mp4` fallback for Safari. Auto-stops after `maxDurationSeconds` (default 120). Revokes previous object URL on each new recording. |
| `frontend/src/components/AudioPlayer.tsx` | Custom audio player over a hidden `<audio>` ref. Props: `{ src, label?, autoPlay?, className? }`. Renders play/pause button, progress bar, and elapsed/total time. `autoPlay` triggers on `src` set. |
| `frontend/src/components/AudioRecorder.tsx` | Recording UI that composes `useAudioRecorder` and `AudioPlayer`. Shows microphone toggle button, live duration counter, and CSS recording indicator. After stop: playback preview + "Use This Recording" confirm button. Calls `onRecordingComplete(blob)` on confirm. Surfaces readable error string if microphone permission denied. |
| `frontend/src/pages/StageBExamPage.tsx` | Three-phase exam page (settings → running → review). Implemented as a single file with three sub-components: `RunningPhase`, `ReviewPhase`, and the main settings-phase default export. See details below. |

### `StageBExamPage.tsx` — implementation notes

**Settings phase** renders topic multi-select with a live search filter, case count radio (1/2/3), duration radio (30/45/60/90 min), difficulty radio (Easy/Medium/Hard), and voice dropdown. On mount it fetches topic list and checks for an active session in parallel via `Promise.allSettled`. If an active session exists, a prominent banner lets the user resume without reconfiguring. "Generate Exam" calls `startStageBSession` and shows a "Generating cases…" spinner during the GPT call.

**Running phase** (`RunningPhase` component):
- Layout: sticky left sidebar (case/stage navigator) + scrollable main area.
- Navigator shows all cases and stages. Future cases are locked (lock icon) until the preceding case is fully completed. Accessible stages show a coloured dot (green = complete, amber = in-progress, grey = unanswered).
- Timer countdown (`formatTimer`) displayed in the top-right sticky bar. On expiry a `finalizedRef` guard prevents double-finalization and calls `finalizeStageBSession` automatically.
- On each stage navigation, the previous TTS object URL is revoked (cleanup in `useEffect` with a `cancelled` flag and `ttsUrlRef`), a new TTS fetch starts, and `audioEnded`/`showText` state resets. If TTS fetch fails, revelation text is shown immediately as a fallback.
- Questions are revealed sequentially: `computeVisibleCount` exposes question `i+1` only after question `i` is answered (either via `q.answered_at` from the session or via a fresh `qStates` result).
- Per question: mode tabs (Type / Record). Text mode: textarea (max 3000 chars). Audio mode: `AudioRecorder` → on complete triggers `transcribeStageBRecording` → editable transcript textarea. Submit calls `submitStageBAnswer`; inline result shows score badge (green ≥7, amber ≥4, red <4), feedback, key points hit, and collapsible model answer.
- For resumed sessions where a question was answered before the current browser session, the display falls back to data stored in the session object (`q.score`, `q.feedback`, `q.key_points_hit`) rather than `qStates`.
- After all questions in a stage are answered, a "Next Stage →" button (or "Finalize Exam ✓" on the last stage of the last case) appears.

**Review phase** (`ReviewPhase` component):
- Top stat cards: Questions Answered / Passed (≥6) / Average Score.
- `CaseAccordion` per case: header shows title, chief complaint, and average score badge. Expandable.
- `StageSection` per stage: collapsible, shows revelation text and a `QuestionReview` per question.
- `QuestionReview` renders: question stem, score badge, student answer, model answer, AI feedback, key points covered (✓), key points missed (✗). "Back to Exams" navigates to `/exams`.

### Modified frontend files

| File | What changed |
|---|---|
| `frontend/src/router.tsx` | Imports `StageBExamPage`; adds protected route `/exams/stage-b` → `StageBExamPage` inside the `ProtectedRoute` group. |
| `frontend/src/components/Sidebar.tsx` | Adds `{ to: "/exams/stage-b", label: "Stage B Oral", icon: <MicrophoneIcon />, subItem: true }` entry beneath the "Exams" nav item. Uses an inline `MicrophoneIcon` SVG consistent with the existing icon style. |

---

## 6. Key Learnings During Implementation

These are the four concrete discoveries recorded in `progress.txt` during development.

**`python-multipart` is required for `UploadFile` routes and is not installed by default.**
FastAPI's `UploadFile` depends on `python-multipart` at runtime. Without it the multipart parsing silently fails. Add it explicitly to `requirements.txt` alongside `fastapi`.

**Parallel case generation requires `ThreadPoolExecutor`, not `asyncio.gather`.**
`generate_rolling_case` calls the OpenAI SDK synchronously. Running sync calls inside `asyncio.gather` blocks the event loop. The correct pattern is `ThreadPoolExecutor` with `as_completed`, using a `future_to_idx` dict to restore case order from out-of-order completion.

**`model_answer`/`key_points` security is enforced by the `_session_to_out` serialization function, not by field exclusion in the DB model.**
The full document (including model answers) is stored in `stage_b_sessions`. A dedicated `_session_to_out` function strips these fields before every GET response. `StageBAnswerResult` and `StageBReportOut` explicitly re-add them after submission/finalization. This pattern keeps the DB schema simple while guaranteeing server-side enforcement.

**`build_stage_tts_text` expects `"text"` but DB questions use `"stem"`.**
The question text key is `"stem"` in the stored document (matching the Stage A schema). The TTS helper was written expecting `"text"`. The route layer transforms before calling: `[{"text": q["stem"]} for q in stage["questions"]]`. Any future refactor that renames the question key in either the DB schema or the helper must update both sides.
