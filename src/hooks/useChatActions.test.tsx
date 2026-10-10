// @vitest-environment jsdom
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { hookHarness } from "@/test/hook-harness";
import { useSessionStore } from "@/stores/session-store";
import { useChatRateLimitStore } from "@/stores/chat-rate-limit-store";
import { trackAnalyticsEvent } from "@/lib/analytics/track";
import { useChatActions } from "./useChatActions";

const stomp = vi.hoisted(() => ({ client: { publish: vi.fn() }, connected: true }));
vi.mock("@/contexts/StompContext", () => ({ useStompContext: () => stomp }));
vi.mock("@/lib/analytics/track", () => ({
  AnalyticsEvents: { chatMessageSent: "chat_message_sent" },
  trackAnalyticsEvent: vi.fn(),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => {
  vi.clearAllMocks();
  useChatRateLimitStore.getState().clearRateLimit();
});

it.each(["text", "ai", "place"] as const)("attributes %s to the published room even if publish changes the selected room", async (type) => {
  useSessionStore.setState({ currentRoomId: " room-a " });
  const hook = hookHarness(() => useChatActions());
  try {
    await hook.render(undefined);
    stomp.client.publish.mockImplementationOnce(() => useSessionStore.setState({ currentRoomId: "room-b" }));
    await act(async () => {
      if (type === "text") hook.current.sendChatMessage("hello");
      else if (type === "ai") hook.current.sendAiMessage("hello");
      else hook.current.sendPlaceMessage({ googlePlaceId: "place", name: "Place", formattedAddress: "Address", latitude: 1, longitude: 2, rating: 4 });
    });
    expect(stomp.client.publish).toHaveBeenCalledWith(expect.objectContaining({
      destination: `/app/rooms/room-a/messages/${type === "text" ? "chat" : type}`,
    }));
    expect(trackAnalyticsEvent).toHaveBeenCalledExactlyOnceWith("chat_message_sent", { room_id: "room-a", message_type: type });
  } finally {
    await hook.unmount();
  }
});

it("does not count empty or rate-limited sends", async () => {
  useSessionStore.setState({ currentRoomId: "room-a" });
  const hook = hookHarness(() => useChatActions());
  try {
    await hook.render(undefined);
    hook.current.sendChatMessage("  ");
    useChatRateLimitStore.getState().applyRateLimit("blocked", 10000);
    hook.current.sendAiMessage("hello");
    expect(stomp.client.publish).not.toHaveBeenCalled();
    expect(trackAnalyticsEvent).not.toHaveBeenCalled();
  } finally {
    await hook.unmount();
  }
});
