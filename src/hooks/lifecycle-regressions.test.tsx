// @vitest-environment jsdom
import { act } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { hookHarness } from "@/test/hook-harness";
import { useOnClickOutside } from "./useOnClickOutside";
import { useSessionPromptVisible } from "./useSessionPromptVisible";
import { usePlanChatPanelReveal } from "./usePlanChatPanelReveal";
import { useResolvedCurrentRoomId } from "./use-room-id";
import { useTripMapBootstrap } from "./useTripMapBootstrap";
import { usePrefetchScheduleRoutes } from "./usePrefetchScheduleRoutes";
import { useSessionStore } from "@/stores/session-store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PlanPlace } from "@/lib/plan/types";
const mocks = vi.hoisted(() => ({
  batch: vi.fn(),
  viewport: vi.fn(),
  cached: vi.fn(),
  write: vi.fn(),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/search" }));
vi.mock("@/lib/plan/schedule-bulk-hydration", () => ({
  fetchAndSeedScheduleRoutesBatch: mocks.batch,
}));
vi.mock("@/lib/map-room-viewport-storage", () => ({
  readRoomMapViewport: mocks.viewport,
}));
vi.mock("@/lib/maps", () => ({
  readDestinationLatLngFromSession: mocks.cached,
  writeDestinationLatLngToSession: mocks.write,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
beforeEach(() => {
  sessionStorage.clear();
  mocks.viewport.mockReset();
  mocks.cached.mockReset();
  mocks.batch.mockReset();
});
it("outside click sees the latest callback and removes the exact listener", async () => {
  const ref = { current: document.createElement("div") };
  document.body.append(ref.current);
  const first = vi.fn();
  const second = vi.fn();
  const hook = hookHarness((callback: () => void) =>
    useOnClickOutside(ref, callback),
  );
  await hook.render(first);
  await hook.render(second);
  ref.current.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
  await hook.unmount();
  document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  expect(second).toHaveBeenCalledTimes(1);
  ref.current.remove();
});
it("session prompts follow their key and dismiss even when storage is unavailable", async () => {
  const hook = hookHarness(useSessionPromptVisible);
  await hook.render("a");
  expect(hook.current.visible).toBe(true);
  await act(async () => hook.current.dismiss());
  expect(hook.current.visible).toBe(false);
  await hook.render("b");
  expect(hook.current.visible).toBe(true);
  await hook.render("a");
  expect(hook.current.visible).toBe(false);
  const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("unavailable");
  });
  await hook.render("c");
  await act(async () => hook.current.dismiss());
  expect(hook.current.visible).toBe(false);
  spy.mockRestore();
  await hook.unmount();
});
it("URL room switches are resolved before children commit and storage never overrides the URL", async () => {
  useSessionStore.setState({ currentRoomId: "old" });
  const hook = hookHarness(useResolvedCurrentRoomId);
  await hook.render("a");
  expect(hook.current.effectiveRoomId).toBe("a");
  await hook.render("b");
  expect(hook.current.effectiveRoomId).toBe("b");
  expect(useSessionStore.getState().currentRoomId).toBe("b");
  await hook.unmount();
});
it("chat reveal fallback resets across close/reopen", async () => {
  vi.useFakeTimers();
  const hook = hookHarness(usePlanChatPanelReveal);
  const args = {
    pathname: "/plan/a",
    chatState: "maximized" as const,
    isMobile: false,
    targetMaxWidthPx: 400,
    measuredLeftWidthPx: 900,
  };
  await hook.render(args);
  expect(hook.current).toBe(false);
  await act(async () => vi.advanceTimersByTime(2000));
  expect(hook.current).toBe(true);
  await hook.render({ ...args, chatState: "closed" });
  await hook.render(args);
  expect(hook.current).toBe(false);
  await hook.unmount();
  vi.useRealTimers();
});
it("route batch gates a switched schedule immediately and ignores late completion", async () => {
  const pending: (() => void)[] = [];
  mocks.batch.mockImplementation(
    () => new Promise<void>((resolve) => pending.push(resolve)),
  );
  const places = [
    { id: "1", title: "one", itemId: 1, location: { lat: 1, lng: 2 } },
    { id: "2", title: "two", itemId: 2, location: { lat: 3, lng: 4 } },
  ] satisfies PlanPlace[];
  const client = new QueryClient();
  const commits: boolean[] = [];
  const hook = hookHarness(
    (id: number) => {
      const ready = usePrefetchScheduleRoutes("a", id, places, true);
      commits.push(ready);
      return ready;
    },
    (child) => (
      <QueryClientProvider client={client}>{child}</QueryClientProvider>
    ),
  );
  await hook.render(1);
  expect(hook.current).toBe(false);
  await act(async () => pending[0]());
  expect(hook.current).toBe(true);
  commits.length = 0;
  await hook.render(2);
  expect(commits[0]).toBe(false);
  await hook.render(3);
  await act(async () => pending[1]());
  expect(hook.current).toBe(false);
  await act(async () => pending[2]());
  expect(hook.current).toBe(true);
  await hook.unmount();
  client.clear();
});
it("map bootstrap ignores geocoding from the previous room and uses the new saved viewport", async () => {
  let finish!: (results: unknown, status: string) => void;
  const lib = {
    Geocoder: class {
      geocode(_request: unknown, callback: typeof finish) {
        finish = callback;
      }
    },
  } as unknown as google.maps.GeocodingLibrary;
  const hook = hookHarness((id: string) =>
    useTripMapBootstrap(id, "서울", true, lib),
  );
  await hook.render("a");
  expect(hook.current.ready).toBe(false);
  mocks.viewport.mockReturnValue({ lat: 35, lng: 129, zoom: 10 });
  await hook.render("b");
  expect(hook.current.center).toEqual({ lat: 35, lng: 129 });
  await act(async () =>
    finish([{ geometry: { location: { lat: () => 1, lng: () => 2 } } }], "OK"),
  );
  expect(hook.current.center).toEqual({ lat: 35, lng: 129 });
  expect(mocks.write).not.toHaveBeenCalled();
  await hook.unmount();
});
