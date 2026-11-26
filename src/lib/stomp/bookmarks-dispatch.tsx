"use client";

import type { QueryClient } from "@tanstack/react-query";

import { invalidateRoomBookmarkQueries } from "@/lib/bookmarks-invalidation";
import { isOwnEcho } from "@/lib/stomp/own-echo";
import type { RoomBookmarkChangedEvent } from "@/types/roomBookmarkStomp";

export async function applyRoomBookmarkStompMessage(queryClient: QueryClient, messageBody: string): Promise<void> {
  const event = JSON.parse(messageBody) as RoomBookmarkChangedEvent;
  const rid = String(event.roomId ?? "").trim();
  if (!rid) return;

  if (isOwnEcho(queryClient, event)) {
    return;
  }

  await invalidateRoomBookmarkQueries(queryClient, event);
}
