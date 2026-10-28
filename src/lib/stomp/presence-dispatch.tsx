"use client";

import type { QueryClient } from "@tanstack/react-query";

import type { RoomMemberListResponse } from "@/lib/api/rooms";
import type { RoomPresenceChangedEvent } from "@/lib/stomp/events";
import { roomMembersQueryKey } from "@/lib/query-keys";
import { readSessionUserId } from "@/lib/session-user-cache";

/** `/app/ping` 직후 서버 presence 반영 대기 */
const PRESENCE_MEMBERS_RESYNC_DELAY_MS = 400;

const roomMembersResyncTimers = new Map<string, ReturnType<typeof setTimeout>>();

function patchMemberOnline(
  queryClient: QueryClient,
  roomId: string,
  userId: number,
  isOnline: boolean,
): boolean {
  const rid = roomId.trim();
  if (!rid.length) return false;

  // 무효화돼 다시 받을 목록은 패치하지 않는다 — setQueryData가 '갱신 필요' 표시를 지워 재조회가 사라진다
  if (queryClient.getQueryState(roomMembersQueryKey(rid))?.isInvalidated) {
    return false;
  }

  const cached = queryClient.getQueryData<RoomMemberListResponse>(
    roomMembersQueryKey(rid),
  );
  if (!cached?.members?.length) return false;

  let touched = false;
  const members = cached.members.map((m) => {
    if (m.userId !== userId) return m;
    if (m.status !== "ACTIVE") return m;
    touched = true;
    return { ...m, isOnline };
  });
  if (!touched) return false;

  queryClient.setQueryData<RoomMemberListResponse>(roomMembersQueryKey(rid), {
    ...cached,
    members,
  });
  return true;
}

/** presence STOMP — 해당 유저 `isOnline`만 캐시 패치 (GET 없음). */
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

/** 구독 직후 — 본인 `isOnline: true` (ping 처리 전 GET 레이스 완화). */
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

/**
 * 방 토픽 구독 1회당 debounced GET 1번 — ping 반영 후 online 상태 재동기화.
 * 캐시가 비었으면 delay 없이 즉시 invalidate.
 */
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

/** @deprecated 구독 직후 `scheduleRoomMembersResyncAfterSubscribe` 사용 */
export async function syncRoomMembersIfCacheEmpty(
  queryClient: QueryClient,
  roomId: string,
): Promise<void> {
  const rid = roomId.trim();
  if (!rid.length) return;

  const cached = queryClient.getQueryData<RoomMemberListResponse>(
    roomMembersQueryKey(rid),
  );
  if (cached?.members?.length) return;

  await invalidateRoomMembersActive(queryClient, rid);
}
