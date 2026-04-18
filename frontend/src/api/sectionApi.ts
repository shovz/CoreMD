import api  from "./apiClient";

export interface SectionResponse {
  chapter_id: string;
  chapter_title: string;
  section_id: string;
  section_title: string;
  content: string;
  html_content: string | null;
}

export const getSectionById = (chapterId: string, sectionId: string) => {
  return api.get<SectionResponse>(
    `/chapters/${chapterId}/sections/${sectionId}`
  );
};
