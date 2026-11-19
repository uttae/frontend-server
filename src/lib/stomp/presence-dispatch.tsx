"use client";

import type { QueryClient } from "@tanstack/react-query";

import type { RoomMemberListResponse } from "@/lib/api/rooms";
import type { RoomPresenceChangedEvent } from "@/lib/stomp/events";
import { invalidateAfterChange } from "@/lib/query-client";
import { roomMembersQueryKey } from "@/lib/query-keys";
import { readSessionUserId } from "@/lib/session-user-cache";

const PRESENCE_MEMBERS_RESYNC_DELAY_MS = 400;

const roomMembersResyncTimers = new Map<string, ReturnType<typeof setTimeout>>();

function patchMemberOnline(
  queryClient: QueryClient,
  roomId: string,
  userId: number,
  isOnline: boolean,
): void {
  const rid = roomId.trim();
  if (!rid.length) return;

  const queryKey = roomMembersQueryKey(rid);
  const state = queryClient.getQueryState<RoomMemberListResponse>(queryKey);
  if (state?.fetchStatus === "fetching") {
    void invalidateAfterChange(queryClient, { queryKey, exact: true });
    return;
  }
  if (state?.isInvalidated) return;

  queryClient.setQueryData<RoomMemberListResponse>(queryKey, (prev) => {
    if (!prev) return prev;
    const target = prev.members.find((m) => m.userId === userId);
    if (target?.status !== "ACTIVE" || target.isOnline === isOnline) return undefined;
    return {
      ...prev,
      members: prev.members.map((m) => (m === target ? { ...m, isOnline } : m)),
    };
  });
}

export function dispatchRoomPresence(
  queryClient: QueryClient,
  roomId: string,
  event: RoomPresenceChangedEvent,
): void {
  const rid = roomId.trim();
  if (!rid.length || !event.userId) return;

  const isOnline = event.type === "USER_CONNECTED";
  patchMemberOnline(queryClient, rid, event.userId, isOnline);
}

export function optimisticPatchSelfOnline(
  queryClient: QueryClient,
  roomId: string,
): void {
  const rid = roomId.trim();
  const me = readSessionUserId(queryClient);
  if (!rid.length || me == null) return;
  patchMemberOnline(queryClient, rid, me, true);
}

async function invalidateRoomMembersActive(
  queryClient: QueryClient,
  roomId: string,
): Promise<void> {
  const rid = roomId.trim();
  if (!rid.length) return;
  await queryClient.invalidateQueries({
    queryKey: roomMembersQueryKey(rid),
    refetchType: "active",
  });
}

export function scheduleRoomMembersResyncAfterSubscribe(
  queryClient: QueryClient,
  roomId: string,
): void {
  const rid = roomId.trim();
  if (!rid.length) return;

  const cached = queryClient.getQueryData<RoomMemberListResponse>(
    roomMembersQueryKey(rid),
  );
  if (!cached?.members?.length) {
    void invalidateRoomMembersActive(queryClient, rid);
    return;
  }

  const prev = roomMembersResyncTimers.get(rid);
  if (prev) clearTimeout(prev);

  roomMembersResyncTimers.set(
    rid,
    setTimeout(() => {
      roomMembersResyncTimers.delete(rid);
      void invalidateRoomMembersActive(queryClient, rid);
    }, PRESENCE_MEMBERS_RESYNC_DELAY_MS),
  );
}
