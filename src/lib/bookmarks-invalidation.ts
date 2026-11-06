import type { QueryClient } from "@tanstack/react-query";

import {
  bookmarkCategoriesQueryKey,
  roomAllBookmarksQueryKey,
} from "@/lib/query-keys";
import type { RoomBookmarkChangedEvent } from "@/types/roomBookmarkStomp";

async function invalidateAllRoomBookmarkQueries(
  queryClient: QueryClient,
  roomId: string,
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: roomAllBookmarksQueryKey(roomId),
    refetchType: "active",
  });
}

/** STOMP `RoomBookmarkChangedEvent.type`별 최소 범위 무효화·제거만 수행합니다. */
export async function invalidateRoomBookmarkQueries(
  queryClient: QueryClient,
  event: RoomBookmarkChangedEvent,
): Promise<void> {
  const rid = String(event.roomId ?? "").trim();
  if (!rid) return;

  switch (event.type) {
    case "BOOKMARK_CREATED":
      await invalidateAllRoomBookmarkQueries(queryClient, rid);
      await queryClient.invalidateQueries({
        queryKey: bookmarkCategoriesQueryKey(rid),
        refetchType: "active",
      });
      break;

    case "BOOKMARK_UPDATED":
      await invalidateAllRoomBookmarkQueries(queryClient, rid);
      await queryClient.invalidateQueries({
        queryKey: bookmarkCategoriesQueryKey(rid),
        refetchType: "active",
      });
      break;

    case "BOOKMARK_DELETED":
      await invalidateAllRoomBookmarkQueries(queryClient, rid);
      await queryClient.invalidateQueries({
        queryKey: bookmarkCategoriesQueryKey(rid),
        refetchType: "active",
      });
      break;

    case "CATEGORY_CREATED":
    case "CATEGORY_UPDATED":
      await queryClient.invalidateQueries({
        queryKey: bookmarkCategoriesQueryKey(rid),
        refetchType: "active",
      });
      break;

    case "CATEGORY_DELETED":
      await invalidateAllRoomBookmarkQueries(queryClient, rid);
      await queryClient.invalidateQueries({
        queryKey: bookmarkCategoriesQueryKey(rid),
        refetchType: "active",
      });
      break;

    default:
      break;
  }
}
