// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useMobileMapTextSearch } from "./useMobileMapTextSearch";
import { useMobileMapSearchStore } from "@/stores/mobile-map-search-store";
import { useMapCenterStore } from "@/stores/map-center-store";

const state = vi.hoisted(() => ({ roomId: "room-a", fetching: true, track: vi.fn() }));
vi.mock("@/hooks/useAnalyticsRoomId", () => ({ useAnalyticsRoomId: () => state.roomId }));
vi.mock("@/hooks/usePlacesSearch", () => ({ usePlacesSearch: () => ({ items: [], isFetching: state.fetching, isSuccess: !state.fetching, isError: false }) }));
vi.mock("@/lib/analytics/track", () => ({ AnalyticsEvents: { search: "search" }, trackAnalyticsEvent: state.track }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), info: vi.fn() }) }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it("keeps the submitted mobile search room while its results are pending", async () => {
  useMapCenterStore.setState({ mapCenter: { lat: 1, lng: 2 }, zoom: 12, radiusMeters: 1000 });
  function Probe() { useMobileMapTextSearch(); return null; }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(<Probe />));
  await act(async () => useMobileMapSearchStore.setState({ textQuery: "cafe", textSearchNonce: 1 }));
  state.roomId = "room-b";
  state.fetching = false;
  await act(async () => root.render(<Probe />));
  expect(state.track).toHaveBeenCalledExactlyOnceWith("search", expect.objectContaining({ room_id: "room-a" }));
  await act(async () => root.unmount());
});
