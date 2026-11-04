// @vitest-environment jsdom
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { hookHarness } from "@/test/hook-harness";
import { useSessionStore } from "@/stores/session-store";
import { useChatActions } from "./useChatActions";

const boundary = vi.hoisted(() => {
  vi.stubEnv("NEXT_PUBLIC_AI_ENABLED", "false");
  return { publish: vi.fn(), track: vi.fn() };
});
vi.mock("@/contexts/StompContext", () => ({
  useStompContext: () => ({ client: { publish: boundary.publish }, connected: true }),
}));
vi.mock("@/lib/analytics/track", () => ({
  AnalyticsEvents: { chatMessageSent: "chat_message_sent" },
  trackAnalyticsEvent: boundary.track,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => vi.unstubAllEnvs());

it("QA off blocks direct AI sends/cancels while ordinary chat and place sharing still publish", async () => {
  useSessionStore.setState({ currentRoomId: "room-qa" });
  const hook = hookHarness(() => useChatActions());
  try {
    await hook.render(undefined);
    expect(hook.current.canSend).toBe(true);
    await act(async () => {
      hook.current.sendAiMessage("추천해줘");
      hook.current.sendCancelAiRequest("request-1");
    });
    expect(boundary.publish).not.toHaveBeenCalled();
    expect(boundary.track).not.toHaveBeenCalled();

    await act(async () => {
      hook.current.sendChatMessage("일반 대화");
      hook.current.sendPlaceMessage({
        googlePlaceId: "place-1", name: "장소", formattedAddress: "주소",
        latitude: 1, longitude: 2, rating: 4,
      });
    });
    expect(boundary.publish.mock.calls.map(([frame]) => frame.destination)).toEqual([
      "/app/rooms/room-qa/messages/chat", "/app/rooms/room-qa/messages/place",
    ]);
    expect(JSON.parse(boundary.publish.mock.calls[0][0].body).content).toBe("일반 대화");
    expect(boundary.track.mock.calls.map(([, properties]) => properties.message_type)).toEqual(["text", "place"]);
  } finally {
    await hook.unmount();
  }
});
