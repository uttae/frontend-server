import { apiFetch } from "@/lib/api/client";
import {
  HttpError,
  isRoomBookmarkDuplicateFromBody,
  readUserFacingMessageFromApiBody,
} from "@/lib/api/errors";
import {
  apiUrl,
  jsonBody,
  requestJson,
  requestVoid,
  tryParseJson,
} from "@/lib/api/http";
import type {
  RoomBookmark,
  RoomBookmarkBulkCreateRequest,
  RoomBookmarkCategoryPatchRequest,
} from "./types";

function normalizeBookmarksResponse(body: unknown): RoomBookmark[] {
  if (Array.isArray(body)) return body as RoomBookmark[];
  if (body !== null && typeof body === "object") {
    const bookmarks = (body as Record<string, unknown>).bookmarks;
    if (Array.isArray(bookmarks)) return bookmarks as RoomBookmark[];
    const data = (body as Record<string, unknown>).data;
    if (Array.isArray(data)) return data as RoomBookmark[];
    if ("bookmarkId" in body && typeof (body as RoomBookmark).bookmarkId === "number") {
      return [body as RoomBookmark];
    }
  }
  return [];
}

/** categoryId 없이 방 전체 북마크를 정렬된 목록으로 일괄 조회 */
export async function getAllRoomBookmarks(
  roomId: string,
): Promise<RoomBookmark[]> {
  const body = await requestJson<unknown>(
    apiUrl(`/rooms/${roomId}/bookmarks`),
    undefined,
    { errorMessage: "북마크 목록 조회 실패" },
  );
  return normalizeBookmarksResponse(body);
}

export async function createRoomBookmarks(
  roomId: string,
  body: RoomBookmarkBulkCreateRequest,
): Promise<RoomBookmark[]> {
  const res = await apiFetch(apiUrl(`/rooms/${roomId}/bookmarks`), {
    method: "POST",
    ...jsonBody(body),
  });

  const parsed = await tryParseJson(res);

  if (!res.ok) {
    if (isRoomBookmarkDuplicateFromBody(parsed)) {
      throw new HttpError(
        409,
        readUserFacingMessageFromApiBody(parsed) ??
          "이미 북마크에 추가된 장소입니다",
      );
    }
    const msg =
      readUserFacingMessageFromApiBody(parsed) ??
      (parsed !== null &&
      typeof parsed === "object" &&
      "message" in parsed &&
      typeof (parsed as { message: unknown }).message === "string"
        ? (parsed as { message: string }).message
        : `북마크 항목 추가 실패: ${res.status}`);
    throw new Error(msg);
  }

  return normalizeBookmarksResponse(parsed);
}

export async function patchRoomBookmarkCategory(
  roomId: string,
  bookmarkId: number,
  body: RoomBookmarkCategoryPatchRequest,
): Promise<RoomBookmark> {
  return requestJson(
    apiUrl(`/rooms/${roomId}/bookmarks/${bookmarkId}/category`),
    { method: "PATCH", ...jsonBody(body) },
    { errorMessage: "북마크 카테고리 변경 실패" },
  );
}

export async function deleteRoomBookmark(
  roomId: string,
  bookmarkId: number,
): Promise<void> {
  return requestVoid(
    apiUrl(`/rooms/${roomId}/bookmarks/${bookmarkId}`),
    { method: "DELETE" },
    { errorMessage: "북마크 항목 삭제 실패" },
  );
}
