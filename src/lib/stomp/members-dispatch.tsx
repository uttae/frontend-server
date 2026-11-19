"use client";

import { expenseKeys } from "@/lib/expenses/expense-queries";

import type { QueryClient } from "@tanstack/react-query";

import {
  ROOMS_QUERY_KEY,
  roomDetailQueryKey,
  roomMembersQueryKey,
} from "@/lib/query-keys";
import { invalidateAfterChange } from "@/lib/query-client";
import { readSessionUserId } from "@/lib/session-user-cache";

import type { RoomMemberPayload } from "./member-events";

function removesViewer(queryClient: QueryClient, event: RoomMemberPayload): boolean {
  if (event.type !== "MEMBER_LEFT" && event.type !== "MEMBER_KICKED") return false;
  return event.detail == null || event.detail.userId === readSessionUserId(queryClient);
}

export function dispatchRoomMemberEvent(
  queryClient: QueryClient,
  subscribedRoomId: string,
  event: RoomMemberPayload,
): void {
  const rid = String(event.roomId ?? "").trim() || subscribedRoomId;
  if (!rid || removesViewer(queryClient, event)) return;

  void invalidateAfterChange(queryClient, { queryKey: roomMembersQueryKey(rid) });
  void invalidateAfterChange(queryClient, { queryKey: expenseKeys.members(rid) });

  if (event.type === "HOST_DELEGATED") {
    void invalidateAfterChange(queryClient, { queryKey: ROOMS_QUERY_KEY });
    void invalidateAfterChange(queryClient, { queryKey: roomDetailQueryKey(rid) });
  }
}
