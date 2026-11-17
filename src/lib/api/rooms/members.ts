import { pickProfileImageUrl } from "@/lib/api/profileImage";
import { apiUrl, jsonBody, requestJson, requestVoid } from "@/lib/api/http";
import type {
  RoomMember,
  RoomMemberListResponse,
  RoomMemberStatus,
} from "./types";

export function isActiveRoomMember(member: RoomMember): boolean {
  return member.status === "ACTIVE";
}

function normalizeMemberListPayload(
  res: RoomMemberListResponse,
): RoomMemberListResponse {
  const members = res.members ?? [];
  return {
    ...res,
    members: members.map((m) => {
      const picked = pickProfileImageUrl(m as unknown as Record<string, unknown>);
      const url = picked ?? m.profileImageUrl ?? null;
      const raw = m as RoomMember & { isOnline?: boolean; status?: string };
      const status: RoomMemberStatus =
        raw.status === "LEFT"
          ? "LEFT"
          : raw.status === "PENDING"
            ? "PENDING"
            : "ACTIVE";
      return {
        ...m,
        profileImageUrl: url,
        status,
        isOnline: status === "ACTIVE" ? Boolean(raw.isOnline) : false,
      } satisfies RoomMember;
    }),
  };
}

export async function getRoomMembers(
  roomId: string,
  signal?: AbortSignal,
): Promise<RoomMemberListResponse> {
  const res = await requestJson<RoomMemberListResponse>(
    apiUrl(`/rooms/${roomId}/members`),
    signal ? { signal } : undefined,
    { errorMessage: "멤버 목록 조회 실패" },
  );
  return normalizeMemberListPayload(res);
}

export async function transferHost(
  roomId: string,
  targetUserId: number,
): Promise<void> {
  return requestVoid(
    apiUrl(`/rooms/${roomId}/host`),
    { method: "PATCH", ...jsonBody({ targetUserId }) },
    { errorMessage: "방장 위임 실패", useHttpError: true },
  );
}

export async function leaveRoom(roomId: string): Promise<void> {
  return requestVoid(
    apiUrl(`/rooms/${roomId}/members/me`),
    { method: "DELETE" },
    { errorMessage: "방 나가기 실패", useHttpError: true },
  );
}

export async function kickMember(
  roomId: string,
  userId: number,
): Promise<void> {
  return requestVoid(
    apiUrl(`/rooms/${roomId}/members/${userId}`),
    { method: "DELETE" },
    { errorMessage: "멤버 추방 실패", useHttpError: true },
  );
}
