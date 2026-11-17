import type { QueryClient } from "@tanstack/react-query";

import { invalidateAfterChange } from "@/lib/query-client";
import {
  bookmarkCategoriesQueryKey,
  roomAllBookmarksQueryKey,
} from "@/lib/query-keys";
import type { RoomBookmarkChangedEvent } from "@/types/roomBookmarkStomp";

/**
 * 폴더 목록(장소 개수 포함)과 방 전체 북마크를 함께 무효화합니다. 북마크가 바뀌는 STOMP 이벤트와
 * 본인 변경(mutation `onSettled`)이 같이 씁니다. 받는 중인 옛 조회는 첫 조회라도 취소하고 새로 받습니다.
 */
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

/**
 * STOMP `RoomBookmarkChangedEvent.type`별로 바뀐 범위를 함께 무효화합니다. 화면에 있는 목록만 바로 다시 받고
 * 나머지는 다시 볼 때 받습니다. 카테고리별 북마크는 방 전체 목록에서 거르므로 전체 목록 하나로 충분합니다.
 */
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
    // 카테고리를 지우면 서버가 그 안의 북마크도 함께 지운다
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
