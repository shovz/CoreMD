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

export const getCases = (specialty?: string) => {
  const params: Record<string, string> = {};
  if (specialty) params.specialty = specialty;
  return api.get<CaseListItem[]>("/cases/", { params });
};

export const getCaseById = (id: string) => {
  return api.get<CaseFull>(`/cases/${id}`);
};
