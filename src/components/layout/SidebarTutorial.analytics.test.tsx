// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { sessionUserQueryKey } from "@/lib/query-keys";
import { SidebarTutorial } from "./SidebarTutorial";

const state = vi.hoisted(() => ({
  roomId: "room-a" as string | undefined,
  track: vi.fn(),
  complete: vi.fn(),
}));
vi.mock("@/hooks/useAnalyticsRoomId", () => ({ useAnalyticsRoomId: () => state.roomId }));
vi.mock("@/hooks/useSessionUser", () => ({ useSessionUser: () => ({ data: { id: 42, tutorialCompleted: false } }) }));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...await importOriginal<typeof import("@tanstack/react-query")>(),
  useQueryClient: () => queryClient,
}));
vi.mock("@/lib/api/user", () => ({ completeTutorial: state.complete }));
vi.mock("@/lib/analytics/track", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/analytics/track")>(),
  trackAnalyticsEvent: state.track,
}));
const queryClient = new QueryClient();
beforeEach(() => {
  queryClient.setQueryData(sessionUserQueryKey, { id: 42, tutorialCompleted: false });
});
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => { document.body.innerHTML = ""; queryClient.clear(); vi.clearAllMocks(); });

it.each(["room-a", undefined])("keeps the tutorial's starting room (%s) through async skip", async (roomId) => {
  state.roomId = roomId;
  let finish!: () => void;
  state.complete.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
  document.body.innerHTML = '<div data-tutorial-target="plan"></div>';
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<SidebarTutorial />));
  expect(state.track.mock.calls[0][0]).toBe("tutorial_begin");
  expect(state.track.mock.calls[0][1].room_id).toBe(roomId);
  const skip = [...host.querySelectorAll("button")].find((button) => button.textContent === "건너뛰기")!;
  await act(async () => skip.click());
  state.roomId = "room-b";
  await act(async () => root.render(<SidebarTutorial />));
  await act(async () => finish());
  expect(state.track.mock.lastCall?.[0]).toBe("tutorial_skip");
  expect(state.track.mock.lastCall?.[1].room_id).toBe(roomId);
  await act(async () => root.unmount());
});

it("updates the same-user completion cache after unmount without sending a pending exit", async () => {
  state.roomId = "room-a";
  let finish!: () => void;
  state.complete.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
  document.body.innerHTML = '<div data-tutorial-target="plan"></div>';
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(<SidebarTutorial />));
  await act(async () => [...host.querySelectorAll("button")].find((button) => button.textContent === "건너뛰기")!.click());
  await act(async () => root.unmount());
  await act(async () => finish());
  expect(state.track).toHaveBeenCalledTimes(1);
  expect(queryClient.getQueryData(sessionUserQueryKey)).toEqual({ id: 42, tutorialCompleted: true });
});


it("drops the pending exit when the account cache changes before rerender", async () => {
  state.roomId = "room-a";
  let finish!: () => void;
  state.complete.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
  document.body.innerHTML = '<div data-tutorial-target="plan"></div>';
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(<SidebarTutorial />));
  await act(async () => [...host.querySelectorAll("button")].find((button) => button.textContent === "건너뛰기")!.click());
  queryClient.setQueryData(sessionUserQueryKey, { id: 84, tutorialCompleted: false });
  await act(async () => finish());
  expect(state.track).toHaveBeenCalledTimes(1);
  expect(queryClient.getQueryData(sessionUserQueryKey)).toEqual({ id: 84, tutorialCompleted: false });
  await act(async () => root.unmount());
});
