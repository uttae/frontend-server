// @vitest-environment jsdom
import { apiFetch } from "@/lib/api/client";
vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn() }));
import { act, useEffect, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import TripMap from "./Map";
import { MobileSearchResultCarousel } from "./MobileSearchResultCarousel";
import { useMapPlaceSearch } from "./useMapPlaceSearch";
import {
  SelectedPlaceProvider,
  useSelectedPlace,
} from "@/contexts/SelectedPlaceContext";
import { MapToolbarLayoutProvider } from "@/contexts/MapToolbarLayoutContext";
import { PlaceDetailPanel } from "@/components/place/PlaceDetailPanel";
import { useSessionStore } from "@/stores/session-store";
import { useMapCenterStore } from "@/stores/map-center-store";
import { usePlaceSearchStore } from "@/stores/place-search-store";
import { useMapPinsFocusStore } from "@/stores/map-pins-focus-store";
import { useSearchMapPinsStore } from "@/stores/search-map-pins-store";
import { registerQueryClient } from "@/lib/query-client";
import { placeDetailQueryKey } from "@/lib/places/place-queries";
import { placePhotoUrlQueryKey } from "@/lib/place-photo-query";
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
  router: { push: vi.fn(), replace: vi.fn(), back: vi.fn() },
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/bookmark",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => boundary.router,
}));
vi.mock("@/contexts/MobileViewContext", () => ({
  useMobileView: () => ({ isMobileDevice: boundary.mobile }),
}));
vi.mock("@/hooks/usePlacesSearch", () => ({
  fetchPlacesPageWithPhotos: boundary.page,
}));
vi.mock("@/lib/analytics/track", () => ({
  AnalyticsEvents: { search: "view_search_results", viewPlace: "view_place" },
  trackAnalyticsEvent: boundary.track,
}));
vi.mock("@vis.gl/react-google-maps", () => ({
  useMap: () => null,
  useMapsLibrary: () => null,
  Map: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick?: (event: {
      detail: { placeId: string; latLng: { lat: number; lng: number } };
      stop: () => void;
    }) => void;
  }) => (
    <div>
      <button
        data-general-poi
        onClick={() =>
          onClick?.({
            detail: { placeId: "result-1", latLng: { lat: 37, lng: 127 } },
            stop: () => {},
          })
        }
      >
        일반 POI
      </button>
      {children}
    </div>
  ),
  AdvancedMarker: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick?: (event: { stop: () => void }) => void;
  }) => (
    <button data-marker onClick={() => onClick?.({ stop: () => {} })}>
      {children}
    </button>
  ),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined, client: QueryClient, host: HTMLDivElement;
let controller!: ReturnType<typeof useMapPlaceSearch>;
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  client?.clear();
  host?.remove();
});
const items = Array.from({ length: 11 }, (_, index) => ({
  googlePlaceId: `result-${index + 1}`,
  name: `결과${index + 1}`,
  category: "카페",
  rating: 4.3,
  userRatingCount: 5,
  location: { lat: 37 + index / 100, lng: 127 },
}));
function prediction(id = "anchor") {
  return { placeId: id, text: { text: "첫 추천", matches: null }, structuredFormat: null };
}
async function render(mobile: boolean) {
  boundary.mobile = mobile;
  boundary.track.mockClear();
  boundary.page.mockReset();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  registerQueryClient(client);
  vi.mocked(apiFetch).mockReset().mockImplementation(async (_url, init) => {
    const body = JSON.parse(init!.body as string);
    return Response.json({ detail: client.getQueryData(placeDetailQueryKey(body.googlePlaceId)), source: "CACHE", cacheStatus: "HIT", googleDetailsRequested: false, termination: "NOT_TERMINATED" });
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
  for (const item of [...items, { ...items[0], googlePlaceId: "anchor" }]) {
    client.setQueryData(placeDetailQueryKey(item.googlePlaceId), {
      googlePlaceId: item.googlePlaceId,
      name: item.name,
      formattedAddress: "주소",
      location: item.location,
      primaryType: "cafe",
      primaryTypeDisplayName: "카페",
      rating: 4.3,
      userRatingCount: 5,
      phoneNumber: "",
      websiteUri: "",
      googleMapsUri: "",
      googleMapsLinks: null,
      regularOpeningHours: null,
      reviewSummary: null,
      reviews: [],
    });
    client.setQueryData(placePhotoUrlQueryKey(item.googlePlaceId), "");
  }
  useSessionStore.setState({ currentRoomId: "room", sessionReady: true });
  useMapCenterStore.setState({ mapCenter: { lat: 1, lng: 2 } });
  usePlaceSearchStore.getState().clear();
  usePlaceSearchStore.getState().setScope("7:room");
  useSearchMapPinsStore.getState().clearPins();
  function View() {
    const api = useMapPlaceSearch(mobile);
    const { selectedPlace, setSelectedPlace } = useSelectedPlace();
    useEffect(() => {
      controller = api;
    });
    return (
      <>
        <MapToolbarLayoutProvider setToolbarRef={() => {}}>
          <TripMap />
        </MapToolbarLayoutProvider>
        {mobile ? (
          <MobileSearchResultCarousel />
        ) : selectedPlace ? (
          <PlaceDetailPanel
            {...selectedPlace}
            onClose={() => setSelectedPlace(null)}
          />
        ) : null}
      </>
    );
  }
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root!.render(
      <QueryClientProvider client={client}>
        <SelectedPlaceProvider>
          <View />
        </SelectedPlaceProvider>
      </QueryClientProvider>,
    ),
  );
}
function views() {
  return boundary.track.mock.calls.filter(([event]) => event === "view_place");
}
function expectPrivateFieldsAbsent(properties: Record<string, unknown>) {
  for (const field of [
    "query",
    "sessionToken",
    "token",
    "googlePlaceId",
    "place_id",
  ])
    expect(properties).not.toHaveProperty(field);
}
it("web prepended absent anchor remains unranked while original results keep third/fourth/eleventh buckets", async () => {
  await render(false);
  boundary.page.mockResolvedValue({ items, nextPageToken: null });
  await act(async () => {
    await controller.confirm({
      query: "원문",
      kind: "whole",
      generation: 0,
      session: { sessionToken: "token", expiresAt: Date.now()+60000 },
      prediction: prediction(),
    });
  });
  expect(usePlaceSearchStore.getState().items[0].googlePlaceId).toBe("anchor");
  expect(views().at(-1)![1].rank_bucket).toBeUndefined();
  for (const [number, rank] of [
    [3, "1_3"],
    [4, "4_10"],
    [11, "11_plus"],
  ] as const) {
    const marker = [
      ...host.querySelectorAll<HTMLButtonElement>("[data-marker]"),
    ].find((button) => button.textContent === `결과${number}`)!;
    await act(async () => marker.click());
    expect(views().at(-1)![1]).toMatchObject({
      interaction_source: "search",
      rank_bucket: rank,
    });
    expectPrivateFieldsAbsent(views().at(-1)![1]);
  }
});
it("web first-place view waits for Text Search membership and keeps its original eleventh rank", async () => {
  await render(false);
  let finish!: (page: unknown) => void;
  boundary.page.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  let pending!: Promise<boolean>;
  await act(async () => {
    pending = controller.confirm({
      query: "원문",
      kind: "whole",
      generation: 0,
      session: { sessionToken: "token", expiresAt: Date.now()+60000 },
      prediction: prediction("result-11"),
    });
  });
  await vi.waitFor(() => expect(boundary.page).toHaveBeenCalled());
  expect(views()).toHaveLength(0);
  await act(async () => {
    finish({ items, nextPageToken: null });
    await pending;
  });
  expect(views()).toHaveLength(1);
  expect(views()[0][1]).toMatchObject({
    rank_bucket: "11_plus",
    interaction_source: "search",
  });
  expectPrivateFieldsAbsent(views()[0][1]);
});
it("web map-center fallback auto-selection retains the first result bucket", async () => {
  await render(false);
  boundary.page.mockResolvedValue({ items, nextPageToken: null });
  await act(async () => {
    await controller.confirm({
      query: "원문",
      kind: "whole",
      generation: 0,
      session: { sessionToken: "token", expiresAt: Date.now()+60000 },
    });
  });
  expect(views()).toHaveLength(1);
  expect(views()[0][1].rank_bucket).toBe("1_3");
});
it("mobile expanded result emits original fourth/eleventh rank while specific prediction stays unranked", async () => {
  await render(true);
  boundary.page.mockResolvedValue({ items, nextPageToken: null });
  await act(async () => {
    await controller.confirm({
      query: "원문",
      kind: "whole",
      generation: 0,
      session: { sessionToken: "token", expiresAt: Date.now()+60000 },
    });
  });
  expect(views()).toHaveLength(0);
  await act(async () =>
    host
      .querySelector<HTMLButtonElement>('button[aria-label="결과4 상세 보기"]')!
      .click(),
  );
  expect(views().at(-1)![1]).toMatchObject({
    rank_bucket: "4_10",
    interaction_source: "search",
  });
  await act(async () => usePlaceSearchStore.getState().select("result-11"));
  expect(views().at(-1)![1]).toMatchObject({
    rank_bucket: "11_plus",
    interaction_source: "search",
  });
  expectPrivateFieldsAbsent(views().at(-1)![1]);
  await act(async () => {
    await controller.confirm({
      query: "원문",
      kind: "specific",
      generation: 0,
      session: { sessionToken: "token", expiresAt: Date.now()+60000 },
      prediction: prediction("result-11"),
    });
  });
  await act(async () =>
    host
      .querySelector<HTMLButtonElement>(
        'button[aria-label="결과11 상세 보기"]',
      )!
      .click(),
  );
  expect(views().at(-1)![1].rank_bucket).toBeUndefined();
  expect(boundary.page).toHaveBeenCalledTimes(1);
});

it("failed Text Search settles the already visible recommendation as one unranked view", async () => {
  await render(false);
  boundary.page.mockRejectedValue(new Error("검색 실패"));
  await act(async () => {
    await controller.confirm({
      query: "원문",
      kind: "whole",
      generation: 0,
      session: { sessionToken: "token", expiresAt: Date.now()+60000 },
      prediction: prediction(),
    });
  });
  expect(views()).toHaveLength(1);
  expect(views()[0][1].rank_bucket).toBeUndefined();
  expectPrivateFieldsAbsent(views()[0][1]);
});

it("cancelling rank lookup keeps complete visible data and cannot add late rank/view events", async () => {
  await render(false);
  let finish!: (page: unknown) => void;
  boundary.page.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  let pending!: Promise<boolean>;
  await act(async () => {
    pending = controller.confirm({
      query: "원문",
      kind: "whole",
      generation: 0,
      session: { sessionToken: "token", expiresAt: Date.now()+60000 },
      prediction: prediction(),
    });
  });
  await vi.waitFor(() => expect(boundary.page).toHaveBeenCalled());
  expect(views()).toHaveLength(0);
  await act(async () => controller.invalidate(false));
  expect(views()).toHaveLength(1);
  expect(views()[0][1].rank_bucket).toBeUndefined();
  await act(async () => {
    finish({ items, nextPageToken: null });
    await pending;
  });
  expect(views()).toHaveLength(1);
  expect(usePlaceSearchStore.getState().items).toEqual([]);
});

it("ordinary POI selection does not inherit a previous Text Search rank", async () => {
  await render(false);
  boundary.page.mockResolvedValue({ items, nextPageToken: null });
  await act(async () => {
    await controller.confirm({
      query: "원문",
      kind: "whole",
      generation: 0,
      session: { sessionToken: "token", expiresAt: Date.now()+60000 },
    });
  });
  const fourth = [
    ...host.querySelectorAll<HTMLButtonElement>("[data-marker]"),
  ].find((button) => button.textContent === "결과4")!;
  await act(async () => fourth.click());
  expect(views().at(-1)![1].rank_bucket).toBe("4_10");
  await act(async () =>
    host.querySelector<HTMLButtonElement>("[data-general-poi]")!.click(),
  );
  expect(views().at(-1)![1].interaction_source).toBe("map");
  expect(views().at(-1)![1].rank_bucket).toBeUndefined();
  expectPrivateFieldsAbsent(views().at(-1)![1]);
});

it("discover ownership settles still-visible complete recommendation once without late rank/view", async () => {
  await render(false);
  let finish!: (page: unknown) => void;
  boundary.page.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  let pending!: Promise<boolean>;
  await act(async () => {
    pending = controller.confirm({
      query: "원문",
      kind: "whole",
      generation: 0,
      session: { sessionToken: "token", expiresAt: Date.now()+60000 },
      prediction: prediction(),
    });
  });
  await vi.waitFor(() => expect(boundary.page).toHaveBeenCalled());
  expect(views()).toHaveLength(0);
  expect(host.textContent).toContain("결과1");
  await act(async () => useMapPinsFocusStore.getState().claimFocus("discover"));
  expect(views()).toHaveLength(1);
  expect(views()[0][1].rank_bucket).toBeUndefined();
  expectPrivateFieldsAbsent(views()[0][1]);
  expect(host.textContent).toContain("결과1");
  await act(async () => {
    finish({ items, nextPageToken: null });
    await pending;
  });
  expect(views()).toHaveLength(1);
  expect(usePlaceSearchStore.getState().items).toEqual([]);
  expect(
    boundary.track.mock.calls.filter(
      ([event]) => event === "view_search_results",
    ),
  ).toHaveLength(0);
});
