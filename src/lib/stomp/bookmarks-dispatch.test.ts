import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sessionUserQueryKey } from "@/lib/query-keys";
import type { RoomBookmarkChangedEvent } from "@/types/roomBookmarkStomp";

const mocks = vi.hoisted(() => ({
  invalidateRoomBookmarkQueries: vi.fn(),
}));

vi.mock("@/lib/bookmarks-invalidation", () => ({
  invalidateRoomBookmarkQueries: mocks.invalidateRoomBookmarkQueries,
}));
vi.mock("@/lib/tab-id", () => ({ getTabId: () => "tab-a" }));

import { applyRoomBookmarkStompMessage } from "@/lib/stomp/bookmarks-dispatch";

const ME = 7;

/** 이 계정(ME)이 폴더를 추가한 이벤트 */
function categoryCreated(originTabId: string | null | undefined): string {
  const event: RoomBookmarkChangedEvent = {
    roomId: "room-1",
    actorUserId: ME,
    type: "CATEGORY_CREATED",
    bookmarkId: 0,
    categoryId: 10,
    originTabId,
  };
  return JSON.stringify(event);
}

describe("applyRoomBookmarkStompMessage — echo of this tab", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.invalidateRoomBookmarkQueries.mockResolvedValue(undefined);
    queryClient = new QueryClient();
    queryClient.setQueryData(sessionUserQueryKey, { id: ME });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("skips a change sent from this tab", async () => {
    await applyRoomBookmarkStompMessage(queryClient, categoryCreated("tab-a"));

    expect(mocks.invalidateRoomBookmarkQueries).not.toHaveBeenCalled();
  });

  it("applies a change whose tab ID matches this tab but comes from another account", async () => {
    queryClient.setQueryData(sessionUserQueryKey, { id: ME + 1 });

    await applyRoomBookmarkStompMessage(queryClient, categoryCreated("tab-a"));

    expect(mocks.invalidateRoomBookmarkQueries).toHaveBeenCalledOnce();
  });

  it("applies a change sent from another tab of the same account", async () => {
    await applyRoomBookmarkStompMessage(queryClient, categoryCreated("tab-b"));

    expect(mocks.invalidateRoomBookmarkQueries).toHaveBeenCalledOnce();
  });

  it.each([null, undefined])(
    "applies a change of the same account without a tab ID (%s) — it may come from another tab",
    async (originTabId) => {
      await applyRoomBookmarkStompMessage(queryClient, categoryCreated(originTabId));

      expect(mocks.invalidateRoomBookmarkQueries).toHaveBeenCalledOnce();
    },
  );
});
