import api from "./apiClient";

export type Difficulty = "easy" | "medium" | "hard";

export interface QuestionOut {
  question_id: string;
  stem: string;
  options: string[];
  topic: string;
  chapter_id: string | null;
  difficulty: Difficulty;
}

export interface QuestionFull extends QuestionOut {
  correct_option: number;
  explanation: string;
  option_explanations: string[];
}

export interface QuestionsFilter {
  topic?: string;
  chapter_id?: string;
  difficulty?: Difficulty;
  search?: string;
  has_followups?: boolean;
  limit?: number;
  offset?: number;
}

export const getQuestions = (filters?: QuestionsFilter) => {
  const params: Record<string, string | number> = {};
  if (filters?.topic) params.topic = filters.topic;
  if (filters?.chapter_id) params.chapter_id = filters.chapter_id;
  if (filters?.difficulty) params.difficulty = filters.difficulty;
  if (filters?.search) params.search = filters.search;
  if (filters?.has_followups !== undefined) params.has_followups = String(filters.has_followups);
  if (filters?.limit !== undefined) params.limit = filters.limit;
  if (filters?.offset !== undefined) params.offset = filters.offset;
  return api.get<QuestionOut[]>("/questions", { params });
};

export const getQuestionTopics = () => {
  return api.get<string[]>("/questions/topics");
};

export const getQuestionById = (id: string) => {
  return api.get<QuestionFull>(`/questions/${id}`);
};

export interface FollowUpsParams {
  trigger?: string;
  limit?: number;
}

export const getQuestionFollowUps = (questionId: string, params?: FollowUpsParams) => {
  return api.get<QuestionOut[]>(`/questions/${questionId}/followups`, { params });
};

export interface AttemptResult {
  correct: boolean;
  correct_option: number;
  explanation: string;
  option_explanations: string[];
}

export const submitAttempt = (questionId: string, selectedOption: number) => {
  return api.post<AttemptResult>(`/questions/${questionId}/attempt`, {
    selected_option: selectedOption,
  });
};

export const getAnsweredCorrectly = () => {
  return api.get<{ question_ids: string[] }>("/questions/answered-correctly");
};

export interface StageAExamItem {
  index: number;
  question_id: string;
  stem: string;
  options: string[];
  topic: string;
  chapter_id: string | null;
  difficulty: Difficulty;
  selected_option: number | null;
  is_correct: boolean | null;
  answered_at: string | null;
}

export interface StageAExamSession {
  session_id: string;
  exam_type: "stage-a";
  status: "active" | "finalized" | "expired";
  blueprint_version: string;
  requested_question_count: number;
  actual_question_count: number;
  shortened_due_to_pool: boolean;
  scope: {
    topics: string[];
    topic_weights: Record<string, number>;
    part_numbers: number[];
    chapter_ids: string[];
    exclude_answered_correctly: boolean;
  };
  question_count: number;
  duration_seconds: number;
  started_at: string;
  expires_at: string;
  finalized_at: string | null;
  items: StageAExamItem[];
}

export interface StageAAnswerResult {
  correct: boolean;
  correct_option: number;
  explanation: string;
  option_explanations: string[];
  answered_count: number;
  correct_count: number;
  remaining_seconds: number;
}

export interface StageAReport {
  session_id: string;
  status: "finalized" | "expired";
  question_count: number;
  requested_question_count: number;
  actual_question_count: number;
  shortened_due_to_pool: boolean;
  scope: {
    topics: string[];
    topic_weights: Record<string, number>;
    part_numbers: number[];
    chapter_ids: string[];
    exclude_answered_correctly: boolean;
  };
  answered_count: number;
  correct_count: number;
  percent_correct: number;
  started_at: string;
  finalized_at: string;
  duration_seconds: number;
  elapsed_seconds: number;
  by_topic: Array<{ topic: string; total: number; answered: number; correct: number }>;
  by_difficulty: Array<{ difficulty: Difficulty; total: number; answered: number; correct: number }>;
  review_items: Array<{
    index: number;
    question_id: string;
    stem: string;
    options: string[];
    topic: string;
    chapter_id: string | null;
    difficulty: Difficulty;
    selected_option: number | null;
    is_correct: boolean | null;
    correct_option: number;
    explanation: string;
    option_explanations: string[];
  }>;
}

export interface StageAStartPayload {
  topics?: string[];
  topic_weights?: Record<string, number>;
  part_numbers?: number[];
  chapter_ids?: string[];
  exclude_answered_correctly?: boolean;
}

export interface StageAPreview {
  eligible_count: number;
  requested_question_count: number;
  actual_question_count: number;
  shortened_due_to_pool: boolean;
}

export interface StageAPreset extends StageAStartPayload {
  preset_id: string;
  name: string;
  topics: string[];
  topic_weights: Record<string, number>;
  part_numbers: number[];
  chapter_ids: string[];
  exclude_answered_correctly: boolean;
  created_at: string;
  updated_at: string;
}

export const startStageAExam = (payload?: StageAStartPayload) => {
  return api.post<StageAExamSession>("/questions/exam-sessions/stage-a/start", payload ?? {});
};

export const getActiveStageAExam = () => {
  return api.get<StageAExamSession>("/questions/exam-sessions/stage-a/active");
};

export const previewStageAExam = (payload?: StageAStartPayload) => {
  return api.post<StageAPreview>("/questions/exam-sessions/stage-a/preview", payload ?? {});
};

export const submitStageAAnswer = (
  sessionId: string,
  payload: { index: number; selected_option: number; rationale_text?: string }
) => {
  return api.post<StageAAnswerResult>(`/questions/exam-sessions/stage-a/${sessionId}/answer`, payload);
};

export const finalizeStageAExam = (sessionId: string) => {
  return api.post<StageAReport>(`/questions/exam-sessions/stage-a/${sessionId}/finalize`);
};

export const getStageAPresets = () => {
  return api.get<StageAPreset[]>("/questions/exam-presets/stage-a");
};

export const createStageAPreset = (payload: {
  name: string;
  topics?: string[];
  topic_weights?: Record<string, number>;
  part_numbers?: number[];
  chapter_ids?: string[];
  exclude_answered_correctly?: boolean;
}) => {
  return api.post<StageAPreset>("/questions/exam-presets/stage-a", payload);
};

export const updateStageAPreset = (
  presetId: string,
  payload: {
    name: string;
    topics?: string[];
    topic_weights?: Record<string, number>;
    part_numbers?: number[];
    chapter_ids?: string[];
    exclude_answered_correctly?: boolean;
  }
) => {
  return api.patch<StageAPreset>(`/questions/exam-presets/stage-a/${presetId}`, payload);
};

export const deleteStageAPreset = (presetId: string) => {
  return api.delete<{ deleted: boolean }>(`/questions/exam-presets/stage-a/${presetId}`);
};
