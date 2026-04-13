import api from "./apiClient";

export interface OverviewStats {
  total_questions_answered: number;
  correct_percentage: number;
  unique_chapters_covered: number;
}

export interface QuestionStats {
  by_difficulty: Record<string, { attempted: number; accuracy: number }>;
  by_topic: { topic: string; attempted: number; accuracy: number }[];
}

export const getOverviewStats = () => {
  return api.get<OverviewStats>("/stats/overview");
};

export const getQuestionStats = () => {
  return api.get<QuestionStats>("/stats/questions");
};
