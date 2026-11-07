"use client";

import type { QueryClient } from "@tanstack/react-query";

import { invalidateRoomBookmarkQueries } from "@/lib/bookmarks-invalidation";
import { isOwnEcho } from "@/lib/stomp/own-echo";
import type { RoomBookmarkChangedEvent } from "@/types/roomBookmarkStomp";

/** bookmarks 토픽 STOMP — React Query 무효화만 (토스트·선 fetch 없음) */
export async function applyRoomBookmarkStompMessage(
  queryClient: QueryClient,
  messageBody: string,
): Promise<void> {
  const event = JSON.parse(messageBody) as RoomBookmarkChangedEvent;
  const rid = String(event.roomId ?? "").trim();
  if (!rid) return;

  /** 본인 탭의 변경은 그 탭의 mutation이 캐시를 맞춘다 */
  if (isOwnEcho(event)) {
    return;
  }

  await invalidateRoomBookmarkQueries(queryClient, event);
}
