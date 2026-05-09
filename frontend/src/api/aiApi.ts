import api from "./apiClient";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface SelectedAiContext {
  selected_text: string;
  chapter_id: string;
  section_id: string;
  chapter_title?: string;
  section_title?: string;
}

export interface Citation {
  chapter_id: string;
  chapter_title: string;
  section_id?: string | null;
  section_title: string;
}

export interface AskResponse {
  answer: string;
  citations: Citation[];
}

export async function askQuestion(
  question: string,
  history: Message[],
  selectedContext?: SelectedAiContext | null
): Promise<AskResponse> {
  const response = await api.post<AskResponse>("/ai/ask", {
    question,
    history,
    selected_context: selectedContext ?? null,
  });
  return response.data;
}
