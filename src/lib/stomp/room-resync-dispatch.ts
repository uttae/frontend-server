import type { QueryClient } from "@tanstack/react-query";

import {
  bookmarkCategoriesQueryKey,
  joinRequestsRootQueryKey,
  roomAllBookmarksQueryKey,
  roomBookmarksByRoomRootQueryKey,
  roomSchedulesQueryKey,
  roomUnreadCountQueryKey,
} from "@/lib/query-keys";

/**
 * 방 토픽을 (다시) 구독한 직후 — 구독하지 않던 동안(첫 연결 전·재연결·`/home` 이탈·방 전환) 놓친
 * 브로드캐스트를 복구하려고 방 공용 데이터를 무효화한다. 화면에 있는 조회만 바로 다시 받고
 * 나머지는 다시 볼 때 받는다. 서버(simple broker)는 구독 성립을 알리지 않아 SUBSCRIBE를 보낸 직후에
 * 하므로 아주 짧은 틈은 남는다. 멤버는 presence 재동기화가, 가계부·채팅 목록은 각자 복구하고,
 * 준비물은 개인 데이터라 넣지 않는다.
 */
export function resyncRoomDataAfterSubscribe(
  queryClient: QueryClient,
  roomId: string,
): void {
  const rid = roomId.trim();
  if (!rid.length) return;

  for (const queryKey of [
    roomSchedulesQueryKey(rid),
    bookmarkCategoriesQueryKey(rid),
    roomBookmarksByRoomRootQueryKey(rid),
    roomAllBookmarksQueryKey(rid),
    roomUnreadCountQueryKey(rid),
  ]) {
    void queryClient.invalidateQueries({ queryKey });
  }
}

/** 개인 큐(`/user/queue/rooms`)를 (다시) 구독한 직후 — 구독하지 않던 동안 놓친 입장 요청을 복구한다 */
export function resyncUserQueueDataAfterSubscribe(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: joinRequestsRootQueryKey() });
}
