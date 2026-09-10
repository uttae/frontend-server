// @vitest-environment jsdom
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { hookHarness } from "@/test/hook-harness";
import { useChatMessages } from "./useChatMessages";
import type { ServerChatMessage } from "@/types/chat";
const mocks = vi.hoisted(() => ({
  history: vi.fn(),
  initial: vi.fn(),
  read: vi.fn(),
  handler: vi.fn(),
  publish: vi.fn(),
}));
vi.mock("@/hooks/useSessionUser", () => ({
  useSessionUser: () => ({ data: { id: 1 } }),
}));
vi.mock("@/hooks/useRooms", () => ({
  useRoomMembers: () => ({ data: { members: [] } }),
}));
vi.mock("@/hooks/useChatActions", () => ({ useChatActions: () => ({}) }));
vi.mock("@/contexts/StompContext", () => {
  const client = { publish: mocks.publish };
  return {
    useStompContext: () => ({
      client,
      connected: true,
      setRoomChatMessageHandler: mocks.handler,
    }),
  };
});
vi.mock("@/lib/api/rooms", () => ({
  getRoomMessageReadStatus: mocks.read,
  getRoomMessages: mocks.history,
}));
vi.mock("@/lib/chat/initialRoomHistory", () => ({
  loadInitialRoomHistory: mocks.initial,
  hasOlderHistoryPage: (count: number, size: number) => count >= size,
}));
vi.mock("@/lib/places/warmChatHistoryPlacePhotos", () => ({
  warmPlacePhotoQueriesFromChatHistory: vi.fn(),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const message = (roomId: string, id: string): ServerChatMessage => ({
  roomId,
  id,
  senderId: 2,
  messageType: "CHAT",
  content: id,
  createdAt: "2026-09-10T00:00:00Z",
});
it("does not mix late older pages across rooms and restores visited room history without another initial GET", async () => {
  mocks.read.mockResolvedValue({ lastReadMessageId: null });
  mocks.initial.mockImplementation(async (roomId: string) => ({
    serverSlice: [message(roomId, `${roomId}-latest`)],
    hasMoreOlder: true,
    hasMoreNewer: false,
    warmHistory: [],
    lastReadMessageId: null,
  }));
  let finish!: (rows: ServerChatMessage[]) => void;
  mocks.history.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const client = new QueryClient();
  const hook = hookHarness(
    (roomId: string | null) => useChatMessages(roomId, { fetchHistory: true }),
    (child) => (
      <QueryClientProvider client={client}>{child}</QueryClientProvider>
    ),
  );
  await hook.render("a");
  const previousRoomFetch = hook.current.fetchOlderMessages;
  await act(async () => hook.current.fetchOlderMessages());
  await hook.render("b");
  mocks.history.mockResolvedValue([]);
  await act(async () => previousRoomFetch());
  expect(mocks.history).toHaveBeenCalledTimes(1);
  await act(async () => finish([message("a", "a-older")]));
  expect(hook.current.messages.map((m) => m.id)).toEqual(["b-latest"]);
  await hook.render("a");
  expect(hook.current.messages.map((m) => m.id)).toEqual(["a-latest"]);
  expect(mocks.initial).toHaveBeenCalledTimes(2);
  await hook.render(null);
  expect(hook.current.messages).toEqual([]);
  await hook.unmount();
  client.clear();
});
