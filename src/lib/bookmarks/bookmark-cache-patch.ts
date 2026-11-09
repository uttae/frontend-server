import type { QueryClient } from "@tanstack/react-query";

import type { BookmarkCategory, RoomBookmark } from "@/lib/api/rooms";
import {
  bookmarkCategoriesQueryKey,
  roomAllBookmarksQueryKey,
} from "@/lib/query-keys";

export function appendBookmarkCategoryToCache(
  queryClient: QueryClient,
  roomId: string,
  category: BookmarkCategory,
): void {
  const rid = roomId.trim();
  if (!rid.length) return;

  queryClient.setQueryData<BookmarkCategory[]>(
    bookmarkCategoriesQueryKey(rid),
    (prev) => {
      // 목록을 받은 적이 없으면 한 건짜리 목록을 만들지 않고 처음 조회에 맡긴다
      if (!prev) return prev;
      if (prev.some((c) => c.categoryId === category.categoryId)) {
        return prev.map((c) =>
          c.categoryId === category.categoryId ? category : c,
        );
      }
      return [...prev, category];
    },
  );
}

function mergeBookmarksById(
  prev: RoomBookmark[],
  incoming: readonly RoomBookmark[],
): RoomBookmark[] {
  const byId = new Map<number, RoomBookmark>();
  for (const row of prev) {
    byId.set(row.bookmarkId, row);
  }
  for (const row of incoming) {
    byId.set(row.bookmarkId, row);
  }
  return [...byId.values()];
}

/** 추가한 북마크를 방 전체 목록에 합친다. 카테고리별 목록은 이 목록에서 거르므로 따로 쓰지 않는다 */
export function appendRoomBookmarksToCache(
  queryClient: QueryClient,
  roomId: string,
  bookmarks: readonly RoomBookmark[],
): void {
  const rid = roomId.trim();
  if (!rid.length || bookmarks.length === 0) return;

  queryClient.setQueryData<RoomBookmark[]>(
    roomAllBookmarksQueryKey(rid),
    // 목록을 받은 적이 없으면 일부만 든 목록을 만들지 않고 처음 조회에 맡긴다
    (prev) => prev && mergeBookmarksById(prev, bookmarks),
  );
}
