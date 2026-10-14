// @vitest-environment jsdom
import { act, useEffect, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { MapToolbarLayoutProvider } from "@/contexts/MapToolbarLayoutContext";
import TripMap from "./Map";
import { MapPlaceSearch } from "./MapPlaceSearch";
import { useMobileMapSearchStore } from "@/stores/mobile-map-search-store";
import { placeDetailQueryKey } from "@/lib/places/place-queries";
import { placePhotoUrlQueryKey } from "@/lib/place-photo-query";
import { useMapPlaceSearch } from "./useMapPlaceSearch";
import {
  SelectedPlaceProvider,
  useSelectedPlace,
} from "@/contexts/SelectedPlaceContext";
import { useSessionStore } from "@/stores/session-store";
import { useMapCenterStore } from "@/stores/map-center-store";
import { usePlaceSearchStore } from "@/stores/place-search-store";
import { useSearchMapPinsStore } from "@/stores/search-map-pins-store";
import { useMapPinsFocusStore } from "@/stores/map-pins-focus-store";
import {
  ROOMS_QUERY_KEY,
  bookmarkCategoriesQueryKey,
  roomAllBookmarksQueryKey,
  roomDetailQueryKey,
  roomSchedulesQueryKey,
  sessionUserQueryKey,
} from "@/lib/query-keys";
const boundary = vi.hoisted(() => ({
  mobile: false,
  page: vi.fn(),
  track: vi.fn(),
  click: undefined as
    | undefined
    | ((event: {
        detail: { placeId?: string; latLng?: { lat: number; lng: number } };
        stop: () => void;
      }) => void),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/bookmark",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/contexts/MobileViewContext", () => ({
  useMobileView: () => ({ isMobileDevice: boundary.mobile }),
}));
vi.mock("@/hooks/usePlacesSearch", () => ({
  fetchPlacesPageWithPhotos: boundary.page,
}));
vi.mock("@/lib/analytics/track", () => ({
  AnalyticsEvents: { search: "search" },
  trackAnalyticsEvent: boundary.track,
}));
vi.mock("@vis.gl/react-google-maps", () => ({
  useMap: () => null,
  useMapsLibrary: () => null,
  Map: function GoogleMapBoundary({
    onClick,
    children,
  }: {
    onClick: typeof boundary.click;
    children: ReactNode;
  }) {
    useEffect(() => {
      boundary.click = onClick;
    }, [onClick]);
    return <div data-google-map>{children}</div>;
  },
  AdvancedMarker: ({ children }: { children: ReactNode }) => (
    <div data-marker>{children}</div>
  ),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
it.each([false, true])(
  "a general POI selection cancels late whole results/pins/analytics (anchor=%s)",
  async (withAnchor) => {
    boundary.mobile = false;
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(ROOMS_QUERY_KEY, {
      rooms: [{ id: "room", destinations: [] }],
    });
    client.setQueryData(roomDetailQueryKey("room"), {
      id: "room",
      destinations: [],
    });
    client.setQueryData(roomSchedulesQueryKey("room"), []);
    client.setQueryData(bookmarkCategoriesQueryKey("room"), []);
    client.setQueryData(roomAllBookmarksQueryKey("room"), []);
    client.setQueryData(sessionUserQueryKey, { id: 7 });
    useSessionStore.setState({ currentRoomId: "room" });
    useMapCenterStore.setState({ mapCenter: { lat: 1, lng: 2 } });
    usePlaceSearchStore.getState().clear();
    usePlaceSearchStore.getState().setScope("7:room");
    useSearchMapPinsStore.getState().clearPins();
    boundary.track.mockClear();
    let finish!: (value: unknown) => void;
    boundary.page.mockReset().mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    let api!: ReturnType<typeof useMapPlaceSearch>;
    function View() {
      const controller = useMapPlaceSearch(false);
      const { selectedPlace } = useSelectedPlace();
      useEffect(() => {
        api = controller;
      });
      return (
        <>
          <div data-selected>{selectedPlace?.googlePlaceId}</div>
          <MapToolbarLayoutProvider setToolbarRef={() => {}}>
            <TripMap />
          </MapToolbarLayoutProvider>
        </>
      );
    }
    const host = document.createElement("div");
    const root = createRoot(host);
    try {
      await act(async () =>
        root.render(
          <QueryClientProvider client={client}>
            <SelectedPlaceProvider>
              <View />
            </SelectedPlaceProvider>
          </QueryClientProvider>,
        ),
      );
      const prediction = withAnchor
        ? ({
            placeId: "anchor",
            mainText: { text: "첫 추천" },
            text: { text: "첫 추천" },
            toPlace: () => ({
              fetchFields: async () => {},
              location: { lat: () => 1, lng: () => 2 },
            }),
          } as unknown as google.maps.places.PlacePrediction)
        : undefined;
      let pending!: Promise<boolean>;
      await act(async () => {
        pending = api.confirm({
          query: "원래 검색어",
          kind: "whole",
          session: {},
          generation: 0,
          prediction,
        });
      });
      await vi.waitFor(() => expect(boundary.page).toHaveBeenCalled());
      expect(boundary.click).toBeDefined();
      await act(async () =>
        boundary.click!({
          detail: { placeId: "poi", latLng: { lat: 3, lng: 4 } },
          stop: vi.fn(),
        }),
      );
      expect(host.querySelector("[data-selected]")?.textContent).toBe("poi");
      await act(async () => {
        finish({
          items: [
            {
              googlePlaceId: "late",
              name: "늦은 결과",
              location: { lat: 5, lng: 6 },
            },
          ],
          nextPageToken: null,
        });
        await pending;
      });
      expect(host.querySelector("[data-selected]")?.textContent).toBe("poi");
      expect(usePlaceSearchStore.getState().items).toEqual([]);
      expect(useSearchMapPinsStore.getState().pins).toEqual([]);
      expect(useMapPinsFocusStore.getState().focus).not.toBe("search");
      expect(boundary.track).not.toHaveBeenCalled();
    } finally {
      await act(async () => root.unmount());
      client.clear();
    }
  },
);

it.each([false, true])(
  "background click retains completed mobile search pins and actual cards (expanded=%s)",
  async (expanded) => {
    boundary.mobile = true;
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(ROOMS_QUERY_KEY, {
      rooms: [{ id: "room", destinations: [] }],
    });
    client.setQueryData(roomDetailQueryKey("room"), {
      id: "room",
      destinations: [],
    });
    client.setQueryData(roomSchedulesQueryKey("room"), []);
    client.setQueryData(bookmarkCategoriesQueryKey("room"), []);
    client.setQueryData(roomAllBookmarksQueryKey("room"), []);
    client.setQueryData(sessionUserQueryKey, { id: 7 });
    client.setQueryData(placeDetailQueryKey("result"), {
      googlePlaceId: "result",
      name: "검색 장소",
      location: { lat: 37, lng: 127 },
      formattedAddress: "주소",
      primaryTypeDisplayName: "카페",
      rating: 4.2,
      userRatingCount: 2,
      regularOpeningHours: null,
      phoneNumber: "",
      websiteUri: "",
      googleMapsLinks: null,
      reviewSummary: null,
      reviews: [],
    });
    client.setQueryData(placePhotoUrlQueryKey("result"), "");
    useSessionStore.setState({ currentRoomId: "room" });
    useMapCenterStore.setState({ mapCenter: { lat: 1, lng: 2 } });
    usePlaceSearchStore.getState().clear();
    usePlaceSearchStore.getState().setScope("7:room");
    useSearchMapPinsStore.getState().clearPins();
    useMobileMapSearchStore.setState({
      open: false,
      textQuery: "",
      textSearchNonce: 0,
    });
    boundary.page
      .mockReset()
      .mockResolvedValue({
        items: [
          {
            googlePlaceId: "result",
            name: "검색 장소",
            category: "카페",
            rating: 4.2,
            location: { lat: 37, lng: 127 },
          },
        ],
        nextPageToken: null,
      });
    const host = document.createElement("div");
    const root = createRoot(host);
    try {
      await act(async () =>
        root.render(
          <QueryClientProvider client={client}>
            <SelectedPlaceProvider>
              <MapToolbarLayoutProvider setToolbarRef={() => {}}>
                <TripMap />
              </MapToolbarLayoutProvider>
              <MapPlaceSearch mobile />
            </SelectedPlaceProvider>
          </QueryClientProvider>,
        ),
      );
      await act(async () => useMobileMapSearchStore.getState().openSearch());
      const input = document.querySelector("dialog input")!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )!.set!.call(input, "원래 검색어");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () =>
        input.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        ),
      );
      await act(async () =>
        usePlaceSearchStore.getState().setExpanded(expanded),
      );
      expect(host.querySelector("h3")?.textContent).toBe("검색 장소");
      const pins = useSearchMapPinsStore.getState().pins;
      const queryCalls = boundary.page.mock.calls.length;
      await act(async () => boundary.click!({ detail: {}, stop: vi.fn() }));
      expect(useSearchMapPinsStore.getState().pins).toEqual(pins);
      expect(useMapPinsFocusStore.getState().focus).toBe("search");
      expect(host.querySelector("h3")?.textContent).toBe("검색 장소");
      expect(host.querySelector("[data-marker]")).not.toBeNull();
      expect(usePlaceSearchStore.getState()).toMatchObject({
        query: "원래 검색어",
        selectedId: "result",
        expanded,
      });
      expect(boundary.page).toHaveBeenCalledTimes(queryCalls);
    } finally {
      await act(async () => root.unmount());
      client.clear();
    }
  },
);
