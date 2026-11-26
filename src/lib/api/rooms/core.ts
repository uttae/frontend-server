import {
  isScheduleLimitExceededFromBody,
  messageForRoomDestinationError,
  withScheduleLimitCountHint,
} from "@/lib/api/errors";
import { apiFetch } from "@/lib/api/client";
import { apiUrl, jsonBody, requestJson, requestVoid, tryParseJson } from "@/lib/api/http";
import type { RoomCreateRequest, RoomCreateResponse, RoomDetail, RoomListResponse, RoomUpdateRequest } from "./types";

export async function createRoom(data: RoomCreateRequest): Promise<RoomCreateResponse> {
  const res = await apiFetch(apiUrl("/rooms"), {
    method: "POST",
    ...jsonBody(data),
  });
  const parsed = await tryParseJson(res);
  if (!res.ok) {
    const fallback = `방 생성 실패: ${res.status}`;
    const msg = isScheduleLimitExceededFromBody(parsed)
      ? withScheduleLimitCountHint(messageForRoomDestinationError(parsed, fallback), parsed)
      : messageForRoomDestinationError(parsed, fallback);
    throw new Error(msg);
  }
  return parsed as RoomCreateResponse;
}

export async function getRooms(params?: { cursor?: string; size?: number }): Promise<RoomListResponse> {
  const url = new URL(apiUrl("/rooms"));
  if (params?.cursor) url.searchParams.set("cursor", params.cursor);
  if (params?.size !== undefined) url.searchParams.set("size", String(params.size));

  return requestJson(url.toString(), undefined, {
    errorMessage: "방 목록 조회 실패",
  });
}

export async function getRoomDetail(roomId: string): Promise<RoomDetail> {
  return requestJson(apiUrl(`/rooms/${roomId}`), undefined, {
    errorMessage: "방 상세 조회 실패",
  });
}

export async function updateRoom(roomId: string, data: RoomUpdateRequest): Promise<RoomCreateResponse> {
  const res = await apiFetch(apiUrl(`/rooms/${roomId}`), {
    method: "PATCH",
    ...jsonBody(data),
  });
  const parsed = await tryParseJson(res);
  if (!res.ok) {
    const msg = messageForRoomDestinationError(parsed, `방 수정 실패: ${res.status}`);
    throw new Error(msg);
  }
  return parsed as RoomCreateResponse;
}

export async function deleteRoom(roomId: string): Promise<void> {
  return requestVoid(apiUrl(`/rooms/${roomId}`), { method: "DELETE" }, { errorMessage: "방 삭제 실패" });
}

export async function regenerateInviteCode(roomId: string): Promise<{ inviteCode: string }> {
  return requestJson(
    apiUrl(`/rooms/${roomId}/invite-code`),
    { method: "POST" },
    { errorMessage: "초대 코드 재발급 실패" },
  );
}
