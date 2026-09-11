import type { Client, IMessage } from "@stomp/stompjs";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { roomUnreadCountQueryKey } from "@/lib/query-keys";
import { subscribeRoomStompTopics } from "./subscribe-room-topics";

vi.mock("@/lib/stomp/bookmarks-dispatch", () => ({ applyRoomBookmarkStompMessage: vi.fn() }));
vi.mock("@/lib/stomp/members-dispatch", () => ({ dispatchRoomMemberEvent: vi.fn() }));
vi.mock("@/lib/stomp/schedules-dispatch", () => ({ dispatchRoomScheduleEvent: vi.fn() }));
vi.mock("@/lib/stomp/user-error-dispatch", () => ({ dispatchUserError: vi.fn() }));
vi.mock("@/lib/stomp/presence-dispatch", () => ({
  dispatchRoomPresence: vi.fn(),
  optimisticPatchSelfOnline: vi.fn(),
  scheduleRoomMembersResyncAfterSubscribe: vi.fn(),
}));

it.each([true, false])("refreshes unread count only when its query is enabled (%s), without a chat handler", async (enabled) => {
  const callbacks = new Map<string, (message: IMessage) => void>();
  const client = {
    subscribe: (topic: string, callback: (message: IMessage) => void) => {
      callbacks.set(topic, callback);
      return { unsubscribe: () => callbacks.delete(topic) };
    },
  } as unknown as Client;
  const queryClient = new QueryClient();
  const key = roomUnreadCountQueryKey("room");
  queryClient.setQueryData(key, { unreadCount: 0 });
  const observer = new QueryObserver(queryClient, {
    queryKey: key,
    queryFn: async () => ({ unreadCount: 3 }),
    staleTime: Infinity,
    enabled,
  });
  const stopObserver = observer.subscribe(() => {});
  const unsubscribe = subscribeRoomStompTopics(client, "room", { current: queryClient }, {});
  try {
    callbacks.get("/topic/rooms/room/messages")!({
      body: JSON.stringify({ id: "new", roomId: "room", messageType: "CHAT" }),
    } as IMessage);
    await vi.waitFor(() => {
      expect(queryClient.getQueryData(key)).toEqual({ unreadCount: enabled ? 3 : 0 });
    });
    if (!enabled) expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
  } finally {
    unsubscribe();
    stopObserver();
    queryClient.clear();
  }
});
