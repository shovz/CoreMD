import api from "./apiClient";

export interface AttemptHistoryItem {
  attempt_id: string;
  question_id: string;
  stem: string;
  selected_option: number;
  correct_option: number;
  is_correct: boolean;
  created_at: string;
}

export interface AttemptHistoryResponse {
  items: AttemptHistoryItem[];
  total: number;
}

export interface DeleteHistoryResponse {
  deleted_count: number;
}

export const getHistory = (limit = 50, offset = 0) => {
  return api.get<AttemptHistoryResponse>("/questions/history", {
    params: { limit, offset },
  });
};

export const deleteHistory = () => {
  return api.delete<DeleteHistoryResponse>("/questions/history");
};

export const deleteSelectedHistory = (questionIds: string[]) => {
  return api.delete<DeleteHistoryResponse>("/questions/history/selected", {
    data: { question_ids: questionIds },
  });
};
