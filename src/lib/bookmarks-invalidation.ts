import type { QueryClient } from "@tanstack/react-query";

import { invalidateAfterChange } from "@/lib/query-client";
import {
  bookmarkCategoriesQueryKey,
  roomAllBookmarksQueryKey,
} from "@/lib/query-keys";
import type { RoomBookmarkChangedEvent } from "@/types/roomBookmarkStomp";

export async function invalidateRoomBookmarkLists(
  queryClient: QueryClient,
  roomId: string,
): Promise<void> {
  const rid = roomId.trim();
  await Promise.all([
    invalidateAfterChange(queryClient, { queryKey: bookmarkCategoriesQueryKey(rid) }),
    invalidateAfterChange(queryClient, { queryKey: roomAllBookmarksQueryKey(rid) }),
  ]);
}

export async function invalidateRoomBookmarkQueries(
  queryClient: QueryClient,
  event: RoomBookmarkChangedEvent,
): Promise<void> {
  const rid = String(event.roomId ?? "").trim();
  if (!rid) return;

  switch (event.type) {
    case "BOOKMARK_CREATED":
    case "BOOKMARK_UPDATED":
    case "BOOKMARK_DELETED":
    case "CATEGORY_DELETED":
      await invalidateRoomBookmarkLists(queryClient, rid);
      break;

    case "CATEGORY_CREATED":
    case "CATEGORY_UPDATED":
      await invalidateAfterChange(queryClient, {
        queryKey: bookmarkCategoriesQueryKey(rid),
      });
      break;

    default:
      break;
  }
}
