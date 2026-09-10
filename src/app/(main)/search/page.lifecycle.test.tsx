// @vitest-environment jsdom
import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import SearchPage from "./page";
import { useMapCenterStore } from "@/stores/map-center-store";
import { useSearchRecenterStore } from "@/stores/search-recenter-store";
import type { PlacesSearchInput } from "@/components/search/PlacesSearchInput";
const state = vi.hoisted(() => ({
  params: new URLSearchParams("q=cafe"),
  replace: vi.fn(),
  track: vi.fn(),
  input: null as ComponentProps<typeof PlacesSearchInput> | null,
  args: [] as unknown[],
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => state.params,
  useRouter: () => ({ replace: state.replace }),
}));
vi.mock("@/hooks/usePlacesSearch", () => ({
  usePlacesSearch: (...args: unknown[]) => {
    state.args = args;
    return { items: [], pageIndex: 0, isSuccess: true, isFetching: false };
  },
}));
vi.mock("@/components/search/PlacesSearchInput", () => ({
  PlacesSearchInput: (props: ComponentProps<typeof PlacesSearchInput>) => {
    state.input = props;
    return null;
  },
}));
vi.mock("@/components/place", () => ({ SearchResultCard: () => null }));
vi.mock("@/components/layout/MainPageHeader", () => ({
  MainPageHeader: () => null,
}));
vi.mock("@/contexts/SectionWidthContext", () => ({
  SetSectionMaxWidth: () => null,
}));
vi.mock("@/hooks/useChatActions", () => ({
  useChatActions: () => ({ canSend: false }),
}));
vi.mock("@/hooks/useChat", () => ({ useChat: () => ({ openChat: vi.fn() }) }));
vi.mock("@/lib/analytics/track", () => ({
  AnalyticsEvents: { search: "search" },
  trackAnalyticsEvent: state.track,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
it("commits URL, same-text and recenter searches once; camera drags alone do not search", async () => {
  useMapCenterStore.setState({
    mapCenter: null,
    zoom: null,
    radiusMeters: null,
  });
  const root = createRoot(document.createElement("div"));
  const render = async () => {
    await act(async () => root.render(<SearchPage />));
  };
  await render();
  expect(state.args[1]).toBeNull();
  await act(async () =>
    useMapCenterStore
      .getState()
      .setMapCamera({
        mapCenter: { lat: 1, lng: 2 },
        zoom: 12,
        radiusMeters: 1000,
      }),
  );
  expect(state.args.slice(0, 4)).toEqual(["cafe", 1, 2, 1000]);
  expect(state.track).toHaveBeenCalledTimes(1);
  await act(async () =>
    useMapCenterStore
      .getState()
      .setMapCamera({
        mapCenter: { lat: 3, lng: 4 },
        zoom: 13,
        radiusMeters: 2000,
      }),
  );
  expect(state.args[1]).toBe(1);
  expect(state.track).toHaveBeenCalledTimes(1);
  await act(async () => state.input!.onSearch("food"));
  state.params = new URLSearchParams("q=food");
  await render();
  expect(state.track).toHaveBeenCalledTimes(2);
  expect(state.args.slice(0, 4)).toEqual(["food", 3, 4, 2000]);
  await act(async () => state.input!.onSearch("food"));
  expect(state.track).toHaveBeenCalledTimes(3);
  await act(async () =>
    useSearchRecenterStore.getState().requestSearchRecenter(),
  );
  expect(state.track).toHaveBeenCalledTimes(4);
  expect(state.track.mock.lastCall?.[1].search_mode).toBe("map_recenter");
  state.params = new URLSearchParams("q=park");
  await render();
  expect(state.track).toHaveBeenCalledTimes(5);
  expect(state.track.mock.lastCall?.[1].search_mode).toBe("text");
  await act(async () => root.unmount());
});

it("keeps the existing default radius when the camera radius is non-finite", async () => {
  state.params = new URLSearchParams("q=cafe");
  useMapCenterStore.setState({ mapCenter: { lat: 1, lng: 2 }, zoom: 12, radiusMeters: NaN });
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(<SearchPage />));
  expect(state.args[3]).toBe(5000);
  await act(async () => root.unmount());
});
