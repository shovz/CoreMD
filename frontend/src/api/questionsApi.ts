import api from "./apiClient";

export type Difficulty = "easy" | "medium" | "hard";

export interface QuestionOut {
  question_id: string;
  stem: string;
  options: string[];
  topic: string;
  chapter_ref: string | null;
  difficulty: Difficulty;
}

export interface QuestionFull extends QuestionOut {
  correct_option: number;
  explanation: string;
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
}

export const submitAttempt = (questionId: string, selectedOption: number) => {
  return api.post<AttemptResult>(`/questions/${questionId}/attempt`, {
    selected_option: selectedOption,
  });
};

export const getAnsweredCorrectly = () => {
  return api.get<{ question_ids: string[] }>("/questions/answered-correctly");
};
