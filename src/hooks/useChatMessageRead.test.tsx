// @vitest-environment jsdom
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { hookHarness } from "@/test/hook-harness";
import { useChatMessageRead } from "./useChatMessageRead";
import type { ServerChatMessage } from "@/types/chat";
const state = vi.hoisted(() => ({
  client: { publish: vi.fn() },
  connected: true,
}));
vi.mock("@/contexts/StompContext", () => ({ useStompContext: () => state }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
it("stable incoming handlers see committed panel/connection state and read dedup is room-scoped", async () => {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const rawMessagesRef = { current: [] as ServerChatMessage[] };
  const msg: ServerChatMessage = {
    id: "same-id",
    roomId: "a",
    senderId: 2,
    messageType: "CHAT",
    createdAt: "2026-09-10T00:00:00Z",
  };
  const hook = hookHarness(
    (p: { roomId: string; panelOpen: boolean }) =>
      useChatMessageRead({ ...p, rawMessagesRef }),
    (child) => (
      <QueryClientProvider client={client}>{child}</QueryClientProvider>
    ),
  );
  await hook.render({ roomId: "a", panelOpen: false });
  const incoming = hook.current.onIncomingMessage;
  await act(async () => incoming(msg, true));
  expect(invalidate).toHaveBeenCalledTimes(1);
  expect(state.client.publish).not.toHaveBeenCalled();
  await hook.render({ roomId: "a", panelOpen: true });
  expect(hook.current.onIncomingMessage).toBe(incoming);
  await act(async () => {
    incoming(msg, true);
    incoming(msg, true);
  });
  expect(state.client.publish).toHaveBeenCalledTimes(1);
  state.connected = false;
  await hook.render({ roomId: "a", panelOpen: true });
  await act(async () => incoming({ ...msg, id: "second" }, true));
  expect(state.client.publish).toHaveBeenCalledTimes(1);
  state.connected = true;
  await hook.render({ roomId: "b", panelOpen: true });
  await act(async () =>
    hook.current.onIncomingMessage({ ...msg, roomId: "b" }, true),
  );
  expect(state.client.publish.mock.lastCall?.[0].destination).toBe(
    "/app/rooms/b/messages/read",
  );
  expect(state.client.publish).toHaveBeenCalledTimes(2);
  await hook.unmount();
  client.clear();
});
