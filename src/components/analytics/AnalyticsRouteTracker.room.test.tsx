// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { AnalyticsRouteTracker } from "./AnalyticsRouteTracker";
import { useSessionStore } from "@/stores/session-store";

const state = vi.hoisted(() => ({
  status: "error" as "error" | "success",
  userId: undefined as number | undefined,
  track: vi.fn(),
  setUserId: vi.fn(),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/search" }));
vi.mock("@/hooks/useSessionUser", () => ({ useSessionUser: () => ({
  data: state.userId ? { id: state.userId } : null, status: state.status,
}) }));
vi.mock("@/lib/analytics/client", () => ({ trackAnalyticsPageView: state.track }));
vi.mock("@/lib/analytics/track", () => ({ setAnalyticsUserId: state.setUserId }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => vi.clearAllMocks());

it.each(["error", "success"] as const)("preserves %s anonymous view, enriches once, then counts a real room change", async (status) => {
  state.status = status;
  state.userId = undefined;
  useSessionStore.setState({ currentRoomId: "room-a", sessionReady: true });
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(<AnalyticsRouteTracker />));
  expect(state.track).toHaveBeenCalledTimes(1);
  expect(state.track.mock.lastCall?.[0]).not.toHaveProperty("room_id");
  expect(state.setUserId.mock.lastCall).toEqual([null]);

  state.status = "success";
  state.userId = 42;
  await act(async () => root.render(<AnalyticsRouteTracker />));
  expect(state.track).toHaveBeenCalledTimes(1);
  expect(state.setUserId.mock.lastCall).toEqual([42]);

  await act(async () => useSessionStore.setState({ currentRoomId: "room-b" }));
  expect(state.track).toHaveBeenCalledTimes(2);
  expect(state.track.mock.lastCall?.[0].room_id).toBe("room-b");
  expect(state.setUserId.mock.invocationCallOrder.at(-1)).toBeLessThan(state.track.mock.invocationCallOrder.at(-1)!);
  await act(async () => root.unmount());
});
