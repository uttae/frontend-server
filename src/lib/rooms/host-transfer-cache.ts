import type { QueryClient } from "@tanstack/react-query";

import type { RoomDetail, RoomListResponse, RoomMemberListResponse } from "@/lib/api/rooms";
import { ROOMS_QUERY_KEY, roomDetailQueryKey, roomMembersQueryKey } from "@/lib/query-keys";

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
  queryClient.setQueryData<RoomDetail>(roomDetailQueryKey(roomId), (prev) => prev && { ...prev, role: "MEMBER" });
  queryClient.setQueryData<RoomListResponse>(
    ROOMS_QUERY_KEY,
    (prev) =>
      prev && {
        ...prev,
        rooms: prev.rooms.map((room) => (room.id === roomId ? { ...room, role: "MEMBER" } : room)),
      },
  );
}
