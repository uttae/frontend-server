import { advanceScheduleLifetime, invalidateMemoTarget } from "@/lib/plan/memo-cache";
import { revokeExpenseRoomAccess } from "@/lib/expenses/expense-recovery";
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { RoomListResponse } from "@/lib/api/rooms";
import {
  joinRequestsQueryKey,
  ROOMS_QUERY_KEY,
  roomDetailQueryKey,
  roomMembersQueryKey,
} from "@/lib/query-keys";
import type { ForcedRoomExitReason } from "@/lib/stomp/user-room-queue";

export const FORCED_ROOM_EXIT_TOAST_MS = 4500;

export function forcedExitToastMessage(
  reason: ForcedRoomExitReason,
  serverMessage?: string,
): string {
  const trimmed = serverMessage?.trim();
  if (trimmed) return trimmed;

  return reason === "kicked"
    ? "방장에 의해 강제 퇴장 당했습니다"
    : "방이 삭제되었습니다";
}

export function showForcedExitToast(
  reason: ForcedRoomExitReason,
  serverMessage?: string,
): void {
  toast(forcedExitToastMessage(reason, serverMessage), {
    duration: FORCED_ROOM_EXIT_TOAST_MS,
  });
}

/** 강퇴·방 삭제 시 홈 목록·방 단위 React Query 캐시에서 해당 roomId 제거 */
export function evictRoomFromClientCaches(
  queryClient: QueryClient,
  roomId: string,
): void {
  const rid = roomId.trim();
  if (!rid.length) return;
  advanceScheduleLifetime(queryClient, rid);
  invalidateMemoTarget(queryClient, rid);
  revokeExpenseRoomAccess(queryClient, rid);

  queryClient.setQueryData<RoomListResponse>(ROOMS_QUERY_KEY, (prev) => {
    if (!prev?.rooms?.length) return prev;
    const rooms = prev.rooms.filter((r) => r.id !== rid);
    return rooms.length === prev.rooms.length ? prev : { ...prev, rooms };
  });

  queryClient.removeQueries({ queryKey: roomDetailQueryKey(rid) });
  queryClient.removeQueries({ queryKey: roomMembersQueryKey(rid) });
  queryClient.removeQueries({ queryKey: joinRequestsQueryKey(rid) });

  queryClient.removeQueries({
    predicate: (q) => {
      const key = q.queryKey;
      return Array.isArray(key) && key[1] === rid;
    },
  });
}

export function refreshRoomsList(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ROOMS_QUERY_KEY });
}
