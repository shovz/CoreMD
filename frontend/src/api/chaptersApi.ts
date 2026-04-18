import api from "./apiClient";

export interface Section {
  id: string;
  title: string;
}

export interface Chapter {
  id: string;
  title: string;
  order?: number;
  specialty?: string;
  part_number?: number;
  part_title?: string;
  chapter_number?: number;
  sections: Section[];
}

export const getChapters = () => {
  return api.get<Chapter[]>("/chapters");
};


export const getChapterById = (chapterId: string) => {
  return api.get<Chapter>(`/chapters/${chapterId}`);
};
