import { apiFetch } from "@/lib/api/client";
import { pickProfileImageUrl } from "@/lib/api/profileImage";
import { apiUrl, jsonBody, requestJson, requestVoid } from "@/lib/api/http";
import type { JoinRequestListResponse, JoinRoomResponse } from "./types";

export type JoinRoomApiResult = JoinRoomResponse & { httpStatus: number };

function normalizeJoinRequests(res: JoinRequestListResponse): JoinRequestListResponse {
  return {
    requests: res.requests.map((r) => ({
      ...r,
      profileImageUrl: pickProfileImageUrl(r as unknown as Record<string, unknown>) ?? r.profileImageUrl ?? null,
    })),
  };
}

export async function getJoinStatus(roomId: string): Promise<JoinRoomResponse> {
  return requestJson(apiUrl(`/rooms/${roomId}/join/status`), undefined, {
    errorMessage: "입장 상태 조회 실패",
    useHttpError: true,
  });
}

export async function joinRoom(inviteCode: string): Promise<JoinRoomApiResult> {
  const res = await apiFetch(apiUrl("/rooms/join"), {
    method: "POST",
    ...jsonBody({ inviteCode }),
  });
  if (!res.ok) {
    throw new Error(`입장 요청 실패: ${res.status}`);
  }
  const data = (await res.json()) as JoinRoomResponse;
  return { ...data, httpStatus: res.status };
}

export async function getJoinRequests(roomId: string): Promise<JoinRequestListResponse> {
  const res = await requestJson<JoinRequestListResponse>(apiUrl(`/rooms/${roomId}/join-requests`), undefined, {
    errorMessage: "입장 요청 목록 조회 실패",
  });
  return normalizeJoinRequests(res);
}

export async function approveJoinRequest(roomId: string, requestId: number): Promise<void> {
  return requestVoid(
    apiUrl(`/rooms/${roomId}/join-requests/${requestId}/approve`),
    { method: "POST" },
    { errorMessage: "입장 승인 실패" },
  );
}

export async function rejectJoinRequest(roomId: string, requestId: number): Promise<void> {
  return requestVoid(
    apiUrl(`/rooms/${roomId}/join-requests/${requestId}/reject`),
    { method: "POST" },
    { errorMessage: "입장 거절 실패" },
  );
}
