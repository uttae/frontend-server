import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { expect, it } from "vitest";
import { optimisticallyClearRoomUnreadCount } from "./message-read";
import { roomUnreadCountQueryKey } from "@/lib/query-keys";
it("keeps unread count cleared when a pre-read response arrives late", async () => {
  const client = new QueryClient();
  const key = roomUnreadCountQueryKey("room");
  let respond!: (value: { unreadCount: number }) => void;
  client.setQueryData(key, { unreadCount: 4 });
  const observer = new QueryObserver(client, {
    queryKey: key, staleTime: Infinity,
    queryFn: () => new Promise<{ unreadCount: number }>(resolve => { respond = resolve; }),
  });
  const stop = observer.subscribe(() => {});
  try {
    const request = client.invalidateQueries({ queryKey: key });
    optimisticallyClearRoomUnreadCount(client, "room");
    expect(client.getQueryData(key)).toEqual({ unreadCount: 0 });
    respond({ unreadCount: 5 });
    await request;
    expect(client.getQueryData(key)).toEqual({ unreadCount: 0 });
  } finally {
    stop(); client.clear();
  }
});
