"use client";

import { useQuery } from "@tanstack/react-query";

import { getRoomUnreadCount } from "@/lib/api/rooms";
import { roomUnreadCountQueryKey } from "@/lib/query-keys";
import { useChatPanelOpen } from "@/hooks/useChatPanelOpen";

export function useRoomUnreadCount(roomId: string | null) {
  const id = roomId?.trim() ?? "";
  const chatPanelOpen = useChatPanelOpen();

  return useQuery({
    queryKey: roomUnreadCountQueryKey(id || null),
    queryFn: () => getRoomUnreadCount(id),
    /** 패널 열림 중에는 GET 없음 — STOMP read + optimistic 캐시만 사용 */
    enabled: id.length > 0 && !chatPanelOpen,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
