import { apiUrl, jsonBody, requestJson, requestVoid } from "@/lib/api/http";
import type { BookmarkCategory, BookmarkCategoryCreateRequest, BookmarkCategoryUpdateRequest } from "./types";

export async function getBookmarkCategories(roomId: string): Promise<BookmarkCategory[]> {
  return requestJson(apiUrl(`/rooms/${roomId}/bookmark-categories`), undefined, {
    errorMessage: "북마크 카테고리 조회 실패",
  });
}

export async function createBookmarkCategory(
  roomId: string,
  body: BookmarkCategoryCreateRequest,
): Promise<BookmarkCategory> {
  return requestJson(
    apiUrl(`/rooms/${roomId}/bookmark-categories`),
    { method: "POST", ...jsonBody(body) },
    { errorMessage: "북마크 카테고리 생성 실패", useHttpError: true },
  );
}

export async function updateBookmarkCategory(
  roomId: string,
  categoryId: number,
  body: BookmarkCategoryUpdateRequest,
): Promise<BookmarkCategory> {
  return requestJson(
    apiUrl(`/rooms/${roomId}/bookmark-categories/${categoryId}`),
    { method: "PATCH", ...jsonBody(body) },
    { errorMessage: "북마크 카테고리 수정 실패", useHttpError: true },
  );
}

export async function deleteBookmarkCategory(roomId: string, categoryId: number): Promise<void> {
  return requestVoid(
    apiUrl(`/rooms/${roomId}/bookmark-categories/${categoryId}`),
    { method: "DELETE" },
    { errorMessage: "북마크 카테고리 삭제 실패" },
  );
}
