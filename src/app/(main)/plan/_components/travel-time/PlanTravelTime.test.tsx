// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ route: vi.fn(), updateMode: vi.fn() }));
vi.mock("@/lib/api/rooms", async original => ({
  ...await original<object>(), getScheduleItemRoute: api.route, updateScheduleItemTravelMode: api.updateMode,
}));
vi.mock("@/contexts/MobileViewContext", () => ({ useMobileView: () => ({ isMobileDevice: false }) }));
import { PlanTravelTime } from "./PlanTravelTime";
let root: Root;
let container: HTMLDivElement;
let client: QueryClient;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.route.mockReset().mockImplementation(async (_r, _s, _i, travelMode) => ({ travelMode, distanceMeters: 100, durationSeconds: 60 }));
  api.updateMode.mockReset().mockImplementation(async (_r, _s, itemId, body) => ({ itemId, scheduleId: 10, googlePlaceId: "a", orderIndex: 0, startTime: null, endTime: null, createdAt: "2026-10-28", ...body }));
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); client.clear(); vi.unstubAllGlobals(); });
async function render(travelMode?: string) {
  await act(async () => root.render(<QueryClientProvider client={client}><PlanTravelTime
    roomId="room" scheduleId={10} segmentSourceItemId={1} scheduleFingerprint=""
    travelMode={travelMode} originGooglePlaceId="a" destinationGooglePlaceId="b"
  /></QueryClientProvider>));
}
it.each([undefined, "BICYCLING", "CYCLING", "BOAT"])("does not query or save unsupported %s until an explicit supported selection", async mode => {
  await render(mode);
  expect(container.textContent).toContain("이동수단 선택");
  expect(container.querySelector("a")).toBeNull();
  expect(api.route).not.toHaveBeenCalled(); expect(api.updateMode).not.toHaveBeenCalled();
  await act(async () => container.querySelector<HTMLButtonElement>("button[aria-expanded]")!.click());
  const choice = [...container.querySelectorAll<HTMLButtonElement>("button[role=option]")].find(b => b.textContent?.includes("자동차"))!;
  await act(async () => choice.click());
  await vi.waitFor(() => expect(api.route).toHaveBeenCalledWith("room", 10, 1, "DRIVING"));
  expect(api.updateMode).toHaveBeenCalledExactlyOnceWith("room", 10, 1, { travelMode: "DRIVING" });
});
it.each(["DRIVING", "WALKING", "TRANSIT"])("queries supported %s without saving it", async mode => {
  await render(mode);
  await vi.waitFor(() => expect(api.route).toHaveBeenCalledWith("room", 10, 1, mode));
  expect(api.updateMode).not.toHaveBeenCalled();
});
