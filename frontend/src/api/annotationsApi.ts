import api from "./apiClient";

export interface Annotation {
  id: string;
  chapter_id: string;
  section_id: string;
  selected_text: string;
  note_text: string;
  created_at: string;
  chapter_title?: string;
}

export interface CreateAnnotationData {
  chapter_id: string;
  section_id: string;
  selected_text: string;
  note_text: string;
}

export const createAnnotation = (data: CreateAnnotationData) =>
  api.post<Annotation>("/annotations", data);

export const getAnnotationsByChapter = (chapterId: string) =>
  api.get<Annotation[]>(`/annotations/chapter/${chapterId}`);

export const getAllAnnotations = () =>
  api.get<Annotation[]>("/annotations");

export const updateAnnotation = (id: string, noteText: string) =>
  api.put<Annotation>(`/annotations/${id}`, { note_text: noteText });

export const deleteAnnotation = (id: string) =>
  api.delete<{ deleted: boolean }>(`/annotations/${id}`);
