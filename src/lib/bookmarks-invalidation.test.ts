import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";

import {
  bookmarkCategoriesQueryKey,
  roomAllBookmarksQueryKey,
} from "@/lib/query-keys";
import type {
  RoomBookmarkChangedEvent,
  RoomBookmarkChangedType,
} from "@/types/roomBookmarkStomp";

import { invalidateRoomBookmarkQueries } from "./bookmarks-invalidation";

const ROOM = "room";

const event = (
  type: RoomBookmarkChangedType,
  roomId = ROOM,
): RoomBookmarkChangedEvent => ({
  type,
  roomId,
  actorUserId: 2,
  bookmarkId: 10,
  categoryId: 1,
});

const clients: QueryClient[] = [];
const stops: (() => void)[] = [];

function newClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  return client;
}

/** 화면에 있는 조회처럼 observer를 붙이고, 응답은 테스트가 풀 때까지 붙잡아 둔다 */
function watch(client: QueryClient, queryKey: readonly unknown[]) {
  const pending: (() => void)[] = [];
  let fetches = 0;
  const observer = new QueryObserver(client, {
    queryKey,
    queryFn: () =>
      new Promise<unknown[]>((resolve) => {
        fetches += 1;
        pending.push(() => resolve([]));
      }),
    staleTime: Infinity,
  });
  client.setQueryData(queryKey, []);
  stops.push(observer.subscribe(() => {}));
  return {
    fetches: () => fetches,
    resolveAll: () => pending.splice(0).forEach((resolve) => resolve()),
  };
}

afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  for (const client of clients.splice(0)) client.clear();
});

describe("invalidateRoomBookmarkQueries", () => {
  it.each<RoomBookmarkChangedType>([
    "BOOKMARK_CREATED",
    "BOOKMARK_UPDATED",
    "BOOKMARK_DELETED",
    "CATEGORY_DELETED",
  ])("%s는 폴더 목록과 전체 북마크를 함께(병렬로) 다시 받는다", async (type) => {
    const client = newClient();
    const categories = watch(client, bookmarkCategoriesQueryKey(ROOM));
    const bookmarks = watch(client, roomAllBookmarksQueryKey(ROOM));

    const done = invalidateRoomBookmarkQueries(client, event(type));

    // 앞의 재조회가 끝나기 전에 둘 다 출발한다
    await expect.poll(() => [categories.fetches(), bookmarks.fetches()]).toEqual([1, 1]);
    categories.resolveAll();
    bookmarks.resolveAll();
    await done;
  });

  it.each<RoomBookmarkChangedType>(["CATEGORY_CREATED", "CATEGORY_UPDATED"])(
    "%s는 폴더 목록만 다시 받는다",
    async (type) => {
      const client = newClient();
      const categories = watch(client, bookmarkCategoriesQueryKey(ROOM));
      const bookmarks = watch(client, roomAllBookmarksQueryKey(ROOM));

      const done = invalidateRoomBookmarkQueries(client, event(type));

      await expect.poll(() => categories.fetches()).toBe(1);
      categories.resolveAll();
      await done;
      expect(bookmarks.fetches()).toBe(0);
      expect(client.getQueryState(roomAllBookmarksQueryKey(ROOM))?.isInvalidated).toBe(false);
    },
  );

  it("화면 밖 목록은 지우지 않고 다시 볼 때 받도록 표시만 한다", async () => {
    const client = newClient();
    client.setQueryData(bookmarkCategoriesQueryKey(ROOM), []);
    client.setQueryData(roomAllBookmarksQueryKey(ROOM), []);

    await invalidateRoomBookmarkQueries(client, event("CATEGORY_DELETED"));

    expect(client.getQueryData(roomAllBookmarksQueryKey(ROOM))).toEqual([]);
    expect(client.getQueryState(bookmarkCategoriesQueryKey(ROOM))?.isInvalidated).toBe(true);
    expect(client.getQueryState(roomAllBookmarksQueryKey(ROOM))?.isInvalidated).toBe(true);
  });

  it("다른 방의 목록은 건드리지 않는다", async () => {
    const client = newClient();
    client.setQueryData(bookmarkCategoriesQueryKey("other"), []);
    client.setQueryData(roomAllBookmarksQueryKey("other"), []);

    await invalidateRoomBookmarkQueries(client, event("BOOKMARK_CREATED"));
    await invalidateRoomBookmarkQueries(client, event("BOOKMARK_CREATED", " "));

    expect(client.getQueryState(bookmarkCategoriesQueryKey("other"))?.isInvalidated).toBe(false);
    expect(client.getQueryState(roomAllBookmarksQueryKey("other"))?.isInvalidated).toBe(false);
  });
});
