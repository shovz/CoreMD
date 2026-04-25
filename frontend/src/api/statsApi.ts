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

export interface DashboardStats {
  streak_days: number;
  questions_answered: number;
  accuracy_pct: number;
  last_chapter: { id: string; title: string } | null;
  last_question: { id: string; topic: string } | null;
  weak_topics: string[];
}

export const getOverviewStats = () => {
  return api.get<OverviewStats>("/stats/overview");
};

export const getQuestionStats = () => {
  return api.get<QuestionStats>("/stats/questions");
};

export const getDashboardStats = () => {
  return api.get<DashboardStats>("/stats/dashboard");
};

export const getStats = () => {
  return api.get<QuestionStats>("/stats/questions");
};
