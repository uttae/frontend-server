import type { QueryClient } from "@tanstack/react-query";

import type {
  RoomDetail,
  RoomListResponse,
  RoomMemberListResponse,
} from "@/lib/api/rooms";
import {
  ROOMS_QUERY_KEY,
  roomDetailQueryKey,
  roomMembersQueryKey,
} from "@/lib/query-keys";

/**
 * 방장 위임 성공 직후 — 응답 본문이 없으므로 확정된 결과(나는 참여자, 대상은 방장)를
 * 방 목록·방 상세·구성원 캐시에 바로 반영한다. 방장 판정이 세 출처 중 하나라도 HOST면
 * 방장으로 보기 때문에, 하나라도 남아 있으면 "먼저 방장을 위임해 주세요"가 다시 뜬다.
 */
export function applyHostTransferToCache(
  queryClient: QueryClient,
  roomId: string,
  viewerId: number | undefined,
  targetUserId: number,
): void {
  queryClient.setQueryData<RoomMemberListResponse>(
    roomMembersQueryKey(roomId),
    (prev) =>
      prev && {
        ...prev,
        members: prev.members.map((member) => {
          if (member.userId === targetUserId) return { ...member, role: "HOST" };
          if (member.userId === viewerId) return { ...member, role: "MEMBER" };
          return member;
        }),
      },
  );
  // 위임 후에도 기존 멤버이므로 초대 링크는 유지한다.
  queryClient.setQueryData<RoomDetail>(
    roomDetailQueryKey(roomId),
    (prev) => prev && { ...prev, role: "MEMBER" },
  );
  queryClient.setQueryData<RoomListResponse>(
    ROOMS_QUERY_KEY,
    (prev) =>
      prev && {
        ...prev,
        rooms: prev.rooms.map((room) =>
          room.id === roomId ? { ...room, role: "MEMBER" } : room,
        ),
      },
  );
}
