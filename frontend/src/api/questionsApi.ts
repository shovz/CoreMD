import api from "./apiClient";

export type Difficulty = "easy" | "medium" | "hard";

export interface QuestionOut {
  question_id: string;
  stem: string;
  options: string[];
  topic: string;
  chapter_ref: string;
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
  limit?: number;
  offset?: number;
}

export const getQuestions = (filters?: QuestionsFilter) => {
  const params: Record<string, string | number> = {};
  if (filters?.topic) params.topic = filters.topic;
  if (filters?.chapter_id) params.chapter_id = filters.chapter_id;
  if (filters?.difficulty) params.difficulty = filters.difficulty;
  if (filters?.limit !== undefined) params.limit = filters.limit;
  if (filters?.offset !== undefined) params.offset = filters.offset;
  return api.get<QuestionOut[]>("/questions/", { params });
};

export const getQuestionById = (id: string) => {
  return api.get<QuestionFull>(`/questions/${id}`);
};
