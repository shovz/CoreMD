import api from "./apiClient";

export type BookmarkType = "question" | "case";

export interface Bookmark {
  type: BookmarkType;
  item_id: string;
  created_at: string;
  document: Record<string, unknown> | null;
}

export const addBookmark = (type: BookmarkType, itemId: string) =>
  api.post<{ bookmarked: boolean }>("/bookmarks", { type, item_id: itemId });

export const removeBookmark = (itemId: string) =>
  api.delete<{ bookmarked: boolean }>(`/bookmarks/${itemId}`);

export const getBookmarks = (type?: BookmarkType) =>
  api.get<Bookmark[]>("/bookmarks", { params: type ? { type } : undefined });
