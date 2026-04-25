import api from "./apiClient";

export interface CaseListItem {
  case_id: string;
  title: string;
  specialty: string;
  presentation: string;
}

export interface CaseFull extends CaseListItem {
  presentation: string;
  history: string;
  physical_exam: string;
  labs: string;
  imaging: string;
  discussion: string;
  diagnosis: string;
  management: string;
  chapter_ref: string;
  chapter_title: string | null;
}

export interface CaseQuestion {
  case_question_id: string;
  case_id: string;
  step: number;
  stem: string;
  options: string[];
  correct_option: number;
  explanation: string;
}

export interface CaseAttemptResult {
  correct: boolean;
  correct_option: number;
  explanation: string;
}

export const getCases = (specialty?: string) => {
  const params: Record<string, string> = {};
  if (specialty) params.specialty = specialty;
  return api.get<CaseListItem[]>("/cases/", { params });
};

export const getCaseById = (id: string) => {
  return api.get<CaseFull>(`/cases/${id}`);
};

export const getCaseQuestions = (caseId: string) => {
  return api.get<CaseQuestion[]>(`/cases/${caseId}/questions`);
};

export const submitCaseAttempt = (
  caseId: string,
  questionId: string,
  selectedOption: number
) => {
  return api.post<CaseAttemptResult>(
    `/cases/${caseId}/questions/${questionId}/attempt`,
    { selected_option: selectedOption }
  );
};
