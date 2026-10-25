import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";

import { expenseKeys } from "@/lib/expenses/expense-queries";
import {
  bookmarkCategoriesQueryKey,
  joinRequestsQueryKey,
  roomSchedulesQueryKey,
  roomUnreadCountQueryKey,
} from "@/lib/query-keys";
import {
  resyncRoomDataAfterSubscribe,
  resyncUserQueueDataAfterSubscribe,
} from "./room-resync-dispatch";

const clients: QueryClient[] = [];
function newClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  return client;
}

afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});

describe("resyncRoomDataAfterSubscribe", () => {
  it("refetches shared room data on screen and only marks the rest for its next mount", async () => {
    const client = newClient();
    let scheduleFetches = 0;
    const observer = new QueryObserver(client, {
      queryKey: roomSchedulesQueryKey("room"),
      queryFn: async () => {
        scheduleFetches += 1;
        return [];
      },
      staleTime: Infinity,
    });
    const stop = observer.subscribe(() => {});
    await observer.refetch();
    client.setQueryData(bookmarkCategoriesQueryKey("room"), []);
    client.setQueryData(roomUnreadCountQueryKey("room"), { unreadCount: 0 });

    resyncRoomDataAfterSubscribe(client, "room");

    await expect.poll(() => scheduleFetches).toBe(2);
    expect(client.getQueryState(bookmarkCategoriesQueryKey("room"))?.isInvalidated).toBe(true);
    expect(client.getQueryState(roomUnreadCountQueryKey("room"))?.isInvalidated).toBe(true);
    stop();
  });

  it("leaves other rooms and data that recovers on its own untouched", () => {
    const client = newClient();
    client.setQueryData(roomSchedulesQueryKey("other"), []);
    client.setQueryData(expenseKeys.room("room"), []);
    client.setQueryData(["packing", "room", 1], []);

    resyncRoomDataAfterSubscribe(client, "room");

    expect(client.getQueryState(roomSchedulesQueryKey("other"))?.isInvalidated).toBe(false);
    expect(client.getQueryState(expenseKeys.room("room"))?.isInvalidated).toBe(false);
    expect(client.getQueryState(["packing", "room", 1])?.isInvalidated).toBe(false);
  });
});

describe("resyncUserQueueDataAfterSubscribe", () => {
  it("marks every room's join requests for refetch", () => {
    const client = newClient();
    client.setQueryData(joinRequestsQueryKey("a"), []);
    client.setQueryData(joinRequestsQueryKey("b"), []);

    resyncUserQueueDataAfterSubscribe(client);

    expect(client.getQueryState(joinRequestsQueryKey("a"))?.isInvalidated).toBe(true);
    expect(client.getQueryState(joinRequestsQueryKey("b"))?.isInvalidated).toBe(true);
  });
});
