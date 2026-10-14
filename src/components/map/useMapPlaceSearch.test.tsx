// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MapPlaceSearchInput } from "@/components/search/MapPlaceSearchInput";
import { useMapPlaceSearch } from "./useMapPlaceSearch";
import { usePlaceSearchStore } from "@/stores/place-search-store";
import { useMapCenterStore } from "@/stores/map-center-store";
import { useSessionStore } from "@/stores/session-store";
const network = vi.hoisted(() => ({
  page: vi.fn(),
  detail: vi.fn(),
  select: vi.fn(),
  track: vi.fn(),
  suggest: vi.fn(),
  user: 7,
}));
vi.mock("@/hooks/usePlacesSearch", () => ({
  fetchPlacesPageWithPhotos: network.page,
}));
vi.mock("@/lib/places/place-queries", () => ({
  fetchPlaceDetail: network.detail,
  placeDetailQueryKey: (id: string) => ["places", "detail", id],
}));
vi.mock("@/contexts/SelectedPlaceContext", () => ({
  useSelectedPlace: () => ({ setSelectedPlace: network.select }),
}));
vi.mock("@/hooks/useSessionUser", () => ({
  useSessionUser: () => ({ data: { id: network.user } }),
}));
vi.mock("@/lib/analytics/track", () => ({
  AnalyticsEvents: { search: "search" },
  trackAnalyticsEvent: network.track,
}));
const library = {};
vi.mock("@vis.gl/react-google-maps", () => ({ useMapsLibrary: () => library }));
vi.mock("@/lib/placesAutocompleteSuggest", () => ({
  AUTOCOMPLETE_SUGGEST_DEBOUNCE_MS: 1,
  newAutocompleteSessionToken: () => ({}),
  circleLocationBias: (center: unknown, radius: number) => ({ center, radius }),
  fetchPlacePredictionsForRequest: network.suggest,
}));
let root: Root, host: HTMLDivElement, api: ReturnType<typeof useMapPlaceSearch>;
function Harness({ mobile = false }: { mobile?: boolean }) {
  const controller = useMapPlaceSearch(mobile);
  useEffect(() => {
    api = controller;
  });
  return (
    <MapPlaceSearchInput
      onConfirm={controller.confirm}
      onInvalidate={controller.invalidate}
      scopeKey={controller.scopeKey}
    />
  );
}
function confirmation(kind: "whole" | "specific" = "whole") {
  const fetchFields = vi.fn().mockResolvedValue(undefined);
  return {
    query: "원래 검색어",
    kind,
    generation: 1,
    session: {},
    prediction: {
      placeId: "first",
      mainText: { text: "추천" },
      secondaryText: { text: "주소" },
      toPlace: () => ({
        fetchFields,
        location: { lat: () => 37, lng: () => 127 },
      }),
    },
  } as unknown as Parameters<typeof api.confirm>[0];
}
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  network.user = 7;
  network.suggest.mockReset().mockResolvedValue([confirmation().prediction]);
  network.page.mockReset().mockResolvedValue({
    items: [
      {
        googlePlaceId: "other",
        name: "다른",
        category: "카페",
        rating: 4.2,
        location: { lat: 38, lng: 128 },
      },
    ],
    nextPageToken: null,
  });
  network.detail.mockReset().mockResolvedValue({
    googlePlaceId: "first",
    name: "추천",
    formattedAddress: "주소",
    primaryTypeDisplayName: "음식점",
    rating: 4.5,
    userRatingCount: 3,
    location: { lat: 37, lng: 127 },
  });
  network.select.mockReset();
  network.track.mockReset();
  useSessionStore.setState({ currentRoomId: "room" });
  usePlaceSearchStore.getState().clear();
  useMapCenterStore.setState({ mapCenter: { lat: 1, lng: 2 }, zoom: 12 });
  host = document.createElement("div");
  root = createRoot(host);
  await act(async () => root.render(<Harness />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
it("web retains first prediction selection absent from text results, preserving result metadata", async () => {
  await act(async () => {
    await api.confirm(confirmation());
  });
  expect(network.select).toHaveBeenCalledWith(
    expect.objectContaining({
      googlePlaceId: "first",
      location: { lat: 37, lng: 127 },
    }),
    expect.objectContaining({ analyticsSource: "search" }),
  );
  expect(
    usePlaceSearchStore.getState().items.map((x) => x.googlePlaceId),
  ).toEqual(["first", "other"]);
  expect(usePlaceSearchStore.getState().items[1].rating).toBe(4.2);
});
it("mobile whole search keeps cards collapsed and never eagerly loads complete Details", async () => {
  await act(async () => root.render(<Harness mobile />));
  await act(async () => {
    await api.confirm(confirmation());
  });
  expect(network.detail).not.toHaveBeenCalled();
  expect(network.select).toHaveBeenLastCalledWith(null);
  expect(usePlaceSearchStore.getState().expanded).toBe(false);
  expect(
    usePlaceSearchStore.getState().items.map((x) => x.googlePlaceId),
  ).toEqual(["other"]);
});
it("mobile specific loads only chosen detail without Text Search", async () => {
  await act(async () => root.render(<Harness mobile />));
  await act(async () => {
    await api.confirm(confirmation("specific"));
  });
  expect(network.page).not.toHaveBeenCalled();
  expect(network.detail).toHaveBeenCalledExactlyOnceWith("first");
  expect(usePlaceSearchStore.getState().items[0].rating).toBe(4.5);
  expect(usePlaceSearchStore.getState().expanded).toBe(false);
});
it("editing input suppresses a late response and analytics", async () => {
  let finish!: (v: unknown) => void;
  network.page.mockReturnValue(
    new Promise((r) => {
      finish = r;
    }),
  );
  const pending = api.confirm(confirmation());
  await vi.waitFor(() => expect(network.page).toHaveBeenCalled());
  await act(async () => api.invalidate(false));
  await act(async () => {
    finish({ items: [], nextPageToken: null });
    await pending;
  });
  expect(usePlaceSearchStore.getState().status).not.toBe("pending");
  expect(network.track).not.toHaveBeenCalled();
});

async function typeInput(value: string) {
  await act(async () => {
    const input = host.querySelector("input")!;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it("actual input editing during confirmation blocks late Text Search publication", async () => {
  let finish!: (v: unknown) => void;
  network.page.mockReturnValue(
    new Promise((r) => {
      finish = r;
    }),
  );
  await typeInput("입력 원문");
  await act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });
  await act(async () =>
    host
      .querySelector("input")!
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
  );
  expect(network.page).toHaveBeenCalled();
  await typeInput("새 입력");
  await act(async () => {
    finish({ items: [{ googlePlaceId: "late" }], nextPageToken: null });
  });
  expect(
    usePlaceSearchStore
      .getState()
      .items.some((x) => x.googlePlaceId === "late"),
  ).toBe(false);
  expect(network.track).not.toHaveBeenCalled();
});
it.each(["room", "account"])(
  "%s change discards late search and clears previous identity data",
  async (change) => {
    let finish!: (v: unknown) => void;
    network.page.mockReturnValue(
      new Promise((r) => {
        finish = r;
      }),
    );
    const pending = api.confirm(confirmation());
    await vi.waitFor(() => expect(network.page).toHaveBeenCalled());
    await act(async () => {
      if (change === "room")
        useSessionStore.setState({ currentRoomId: "different" });
      else network.user = 8;
      root.render(<Harness />);
    });
    await act(async () => {
      finish({ items: [{ googlePlaceId: "late" }], nextPageToken: null });
      await pending;
    });
    expect(usePlaceSearchStore.getState().items).toEqual([]);
    expect(host.querySelector("input")?.value).toBe("");
    expect(network.track).not.toHaveBeenCalled();
  },
);

it("editing while web's first-place detail is pending clears its visible selection", async () => {
  let finish!: (value: unknown) => void;
  network.page.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const pending = api.confirm(confirmation());
  await vi.waitFor(() => expect(network.page).toHaveBeenCalled());
  expect(network.select).toHaveBeenLastCalledWith(
    expect.objectContaining({ googlePlaceId: "first" }),
    expect.any(Object),
  );
  await act(async () => api.invalidate(false));
  expect(network.select).toHaveBeenLastCalledWith(null);
  await act(async () => {
    finish({ items: [], nextPageToken: null });
    await pending;
  });
});
