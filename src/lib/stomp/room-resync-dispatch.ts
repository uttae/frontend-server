import type { QueryClient } from "@tanstack/react-query";

import {
  bookmarkCategoriesQueryKey,
  joinRequestsRootQueryKey,
  roomAllBookmarksQueryKey,
  roomSchedulesQueryKey,
  roomUnreadCountQueryKey,
} from "@/lib/query-keys";

export function resyncRoomDataAfterSubscribe(
  queryClient: QueryClient,
  roomId: string,
): void {
  const rid = roomId.trim();
  if (!rid.length) return;

  for (const queryKey of [
    roomSchedulesQueryKey(rid),
    bookmarkCategoriesQueryKey(rid),
    roomAllBookmarksQueryKey(rid),
    roomUnreadCountQueryKey(rid),
  ]) {
    void queryClient.invalidateQueries({ queryKey });
  }
}

export function resyncUserQueueDataAfterSubscribe(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: joinRequestsRootQueryKey() });
}
