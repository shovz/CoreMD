import api from "./apiClient";

export interface CaseOut {
  case_id: string;
  title: string;
  specialty: string;
  difficulty: string;
  chief_complaint: string;
}

export interface CaseFull extends CaseOut {
  history: string;
  physical_exam: string;
  workup: string;
  questions: CaseQuestion[];
}

export interface CaseQuestion {
  question: string;
  options: string[];
  correct_option: number;
  explanation: string;
}

export const getCases = (specialty?: string) => {
  const params: Record<string, string> = {};
  if (specialty) params.specialty = specialty;
  return api.get<CaseOut[]>("/cases/", { params });
};

export const getCaseById = (id: string) => {
  return api.get<CaseFull>(`/cases/${id}`);
};
