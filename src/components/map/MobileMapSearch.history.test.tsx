// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { MapPlaceSearch } from "./MapPlaceSearch";
import {
  SelectedPlaceProvider,
  useSelectedPlace,
} from "@/contexts/SelectedPlaceContext";
import { addMapSearchHistory } from "@/lib/map-search-history";
import { usePlaceSearchStore } from "@/stores/place-search-store";
import { useMobileMapSearchStore } from "@/stores/mobile-map-search-store";
import { useSessionStore } from "@/stores/session-store";
import { useMapPinsFocusStore } from "@/stores/map-pins-focus-store";
const boundary = vi.hoisted(() => ({ detail: vi.fn() }));
const library = {};
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@vis.gl/react-google-maps", () => ({ useMapsLibrary: () => library }));
vi.mock("@/hooks/useSessionUser", () => ({
  useSessionUser: () => ({ data: { id: 7 } }),
}));
vi.mock("@/lib/places/place-queries", () => ({
  fetchPlaceDetail: boundary.detail,
}));
vi.mock("./MobileSearchResultCarousel", () => ({
  MobileSearchResultCarousel: () => {
    const items = usePlaceSearchStore((s) => s.items);
    return <div data-search-card>{items[0]?.name}</div>;
  },
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
it("saved history selection closes an existing POI and exposes its new collapsed card/map selection", async () => {
  useSessionStore.setState({ currentRoomId: "room" });
  usePlaceSearchStore.getState().clear();
  usePlaceSearchStore.getState().setScope("7:room");
  usePlaceSearchStore.setState({ searchRankBuckets: { saved: "11_plus" } });
  useMobileMapSearchStore.setState({
    open: true,
    textQuery: "",
    textSearchNonce: 0,
  });
  localStorage.clear();
  addMapSearchHistory(7, {
    type: "place",
    googlePlaceId: "saved",
    name: "저장 장소",
    address: "주소",
  });
  boundary.detail.mockResolvedValue({
    googlePlaceId: "saved",
    name: "저장 장소",
    formattedAddress: "주소",
    primaryTypeDisplayName: "카페",
    rating: 4.3,
    userRatingCount: 3,
    regularOpeningHours: null,
    location: { lat: 37, lng: 127 },
  });
  function View() {
    const { selectedPlace, setSelectedPlace } = useSelectedPlace();
    useEffect(() => {
      setSelectedPlace({
        name: "기존 POI",
        category: "",
        rating: null,
        googlePlaceId: "old",
        location: { lat: 1, lng: 2 },
      });
    }, [setSelectedPlace]);
    return (
      <>
        <div data-detail>{selectedPlace?.name}</div>
        <MapPlaceSearch mobile />
      </>
    );
  }
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <SelectedPlaceProvider>
          <View />
        </SelectedPlaceProvider>,
      ),
    );
    expect(host.querySelector("[data-detail]")?.textContent).toBe("기존 POI");
    const saved = [...document.querySelectorAll("dialog button")].find(
      (button) => button.textContent?.includes("저장 장소"),
    )!;
    await act(async () => (saved as HTMLButtonElement).click());
    expect(host.querySelector("[data-detail]")?.textContent).toBe("");
    expect(host.querySelector("[data-search-card]")?.textContent).toBe(
      "저장 장소",
    );
    expect(usePlaceSearchStore.getState()).toMatchObject({
      selectedId: "saved",
      expanded: false,
      items: [{ googlePlaceId: "saved", location: { lat: 37, lng: 127 } }],
    });
    expect(usePlaceSearchStore.getState().searchRankBuckets).toEqual({});
    expect(useMapPinsFocusStore.getState().focus).toBe("search");
    expect(useMobileMapSearchStore.getState().open).toBe(false);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    localStorage.clear();
  }
});
