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

export interface CaseHistoryItem {
  attempt_id: string;
  case_id: string;
  case_title: string;
  question_id: string;
  selected_option: number;
  correct_option: number;
  is_correct: boolean;
  created_at: string;
}

export interface CaseHistoryResponse {
  items: CaseHistoryItem[];
  total: number;
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

export const getCaseHistory = (limit = 50, offset = 0) => {
  return api.get<CaseHistoryResponse>("/cases/history", {
    params: { limit, offset },
  });
};

export const deleteCaseHistory = () => {
  return api.delete<DeleteHistoryResponse>("/cases/history");
};

export const deleteSelectedCaseHistory = (caseIds: string[]) => {
  return api.delete<DeleteHistoryResponse>("/cases/history/selected", {
    data: { case_ids: caseIds },
  });
};
