import api from "./apiClient";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

// ---- Types ----------------------------------------------------------------

export type Difficulty = "easy" | "medium" | "hard";
export type AnswerMode = "text" | "audio";

export interface StageBQuestion {
  question_id: string;
  stage_index: number;
  stem: string;
  topic: string;
  difficulty: Difficulty;
  student_answer: string | null;
  answer_mode: AnswerMode | null;
  score: number | null;
  feedback: string | null;
  key_points_hit: string[] | null;
  answered_at: string | null;
}

export interface StageBQuestionFull extends StageBQuestion {
  model_answer: string | null;
  key_points: string[] | null;
}

export interface StageBStage {
  stage_index: number;
  title: string;
  context: string;
  questions: StageBQuestion[];
}

export interface StageBCase {
  case_index: number;
  case_id: string;
  title: string;
  chief_complaint: string;
  stages: StageBStage[];
}

export interface StageBSession {
  session_id: string;
  exam_type: string;
  status: string;
  difficulty: Difficulty;
  voice: string;
  case_count: number;
  duration_minutes: number;
  started_at: string;
  expires_at: string;
  finalized_at: string | null;
  current_case_idx: number;
  current_stage_idx: number;
  cases: StageBCase[];
}

export interface StageBAnswerResult {
  score: number;
  feedback: string;
  key_points_hit: string[];
  model_answer: string;
  remaining_seconds: number;
  all_stage_questions_answered: boolean;
}

export interface StageBTopicStats {
  topic: string;
  total: number;
  answered: number;
  avg_score: number | null;
}

export interface StageBDifficultyStats {
  difficulty: string;
  total: number;
  answered: number;
  avg_score: number | null;
}

export interface StageBStageReport {
  stage_index: number;
  title: string;
  context: string;
  questions: StageBQuestionFull[];
}

export interface StageBCaseReport {
  case_index: number;
  case_id: string;
  title: string;
  chief_complaint: string;
  stages: StageBStageReport[];
  answered_count: number;
  total_questions: number;
  avg_score: number | null;
}

export interface StageBReport {
  session_id: string;
  status: string;
  difficulty: Difficulty;
  voice: string;
  case_count: number;
  duration_minutes: number;
  started_at: string;
  finalized_at: string | null;
  elapsed_seconds: number;
  total_questions: number;
  answered_count: number;
  avg_score: number | null;
  by_topic: StageBTopicStats[];
  by_difficulty: StageBDifficultyStats[];
  cases: StageBCaseReport[];
}

export interface StageBStartPayload {
  topics?: string[];
  case_count?: number;
  duration_minutes?: number;
  difficulty?: Difficulty;
  voice?: string;
}

export interface StageBAnswerPayload {
  student_answer: string;
  answer_mode: AnswerMode;
}

// ---- Session management ---------------------------------------------------

export const startStageBSession = (payload: StageBStartPayload = {}) =>
  api.post<StageBSession>("/stage-b/sessions/start", payload);

export const getActiveStageBSession = () =>
  api.get<StageBSession>("/stage-b/sessions/active");

export const finalizeStageBSession = (sessionId: string) =>
  api.post<StageBReport>(`/stage-b/sessions/${sessionId}/finalize`);

export const getStageBReport = (sessionId: string) =>
  api.get<StageBReport>(`/stage-b/sessions/${sessionId}/report`);

export const advanceStage = (sessionId: string) =>
  api.post<StageBSession>(`/stage-b/sessions/${sessionId}/advance-stage`);

// ---- TTS ------------------------------------------------------------------

// Must use fetch() — audio element cannot send custom Authorization headers.
export const fetchStageBTts = async (
  sessionId: string,
  caseIdx: number,
  stageIdx: number,
): Promise<string> => {
  const token = localStorage.getItem("access_token");
  const res = await fetch(
    `${BASE_URL}/stage-b/sessions/${sessionId}/tts/${caseIdx}/${stageIdx}`,
    {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );
  if (!res.ok) {
    throw new Error(`TTS request failed: ${res.status}`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
};

// ---- Transcription --------------------------------------------------------

export const transcribeStageBRecording = (
  sessionId: string,
  caseIdx: number,
  stageIdx: number,
  questionNum: number,
  audioBlob: Blob,
) => {
  const form = new FormData();
  form.append("audio_file", audioBlob, "recording.webm");
  return api.post<{ transcription: string }>(
    `/stage-b/sessions/${sessionId}/transcribe/${caseIdx}/${stageIdx}/${questionNum}`,
    form,
  );
};

// ---- Answer submission ----------------------------------------------------

export const submitStageBAnswer = (
  sessionId: string,
  caseIdx: number,
  stageIdx: number,
  questionNum: number,
  payload: StageBAnswerPayload,
) =>
  api.post<StageBAnswerResult>(
    `/stage-b/sessions/${sessionId}/answer/${caseIdx}/${stageIdx}/${questionNum}`,
    payload,
  );
