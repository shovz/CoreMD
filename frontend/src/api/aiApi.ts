import api from "./apiClient";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface Citation {
  chapter_id: string;
  chapter_title: string;
  section_title: string;
}

export interface AskResponse {
  answer: string;
  citations: Citation[];
}

export async function askQuestion(
  question: string,
  history: Message[]
): Promise<AskResponse> {
  const response = await api.post<AskResponse>("/ai/ask", {
    question,
    history,
  });
  return response.data;
}
