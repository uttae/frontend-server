"use client";

import type { QueryClient } from "@tanstack/react-query";

import type { RoomMemberListResponse } from "@/lib/api/rooms";
import type { RoomPresenceChangedEvent } from "@/lib/stomp/events";
import { roomMembersQueryKey } from "@/lib/query-keys";
import { readSessionUserId } from "@/lib/session-user-cache";

/** `/app/ping` 직후 서버 presence 반영 대기 */
const PRESENCE_MEMBERS_RESYNC_DELAY_MS = 400;

const roomMembersResyncTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * 접속 상태(`isOnline`) 한 명분만 캐시에서 고친다. AGENTS.md 예외: 접속·해제는 멤버 변경보다 훨씬 잦아
 * 이벤트마다 멤버 목록 GET을 보내지 않는다. 범위는 `room-members`의 ACTIVE 멤버 `isOnline`뿐이다.
 * 받는 중인 목록은 이 접속 변화 전에 출발한 조회일 수 있어 늦게 와서 패치를 덮으므로, 그때는 고치지 않고 다시 받는다.
 */
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
  // 옛 조회를 취소하고 새로 받는다. 목록이 아직 없는 첫 조회는 TanStack이 취소하지 않고 합류하며, 구독 직후 재동기화가 맞춘다
  if (state?.fetchStatus === "fetching") {
    void queryClient.invalidateQueries({ queryKey, exact: true });
    return;
  }
  // 무효화돼 다시 받을 목록은 패치하지 않는다 — setQueryData가 '갱신 필요' 표시를 지워 재조회가 사라진다
  if (state?.isInvalidated) return;

  queryClient.setQueryData<RoomMemberListResponse>(queryKey, (prev) => {
    // 목록을 받은 적이 없으면 만들지 않고 처음 조회에 맡긴다
    if (!prev) return prev;
    const target = prev.members.find((m) => m.userId === userId);
    // 바뀌는 것이 없으면 undefined를 돌려 쓰지 않는다
    if (target?.status !== "ACTIVE" || target.isOnline === isOnline) return undefined;
    return {
      ...prev,
      members: prev.members.map((m) => (m === target ? { ...m, isOnline } : m)),
    };
  });
}

/** presence STOMP — 해당 유저 `isOnline`만 캐시 패치. 멤버 목록을 받는 중이면 패치 대신 다시 받는다 */
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
