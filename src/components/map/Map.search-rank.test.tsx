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
  InfoWindow: ({ children }: { children: ReactNode }) => (
    <div role="dialog" aria-label="검색 장소 미리보기">{children}</div>
  ),
  MapControl: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ControlPosition: { RIGHT_BOTTOM: 9 },
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
    zIndex,
  }: {
    children: ReactNode;
    zIndex?: number;
    onClick?: (event: { stop: () => void }) => void;
  }) => (
    <button data-marker data-priority={zIndex} onClick={() => onClick?.({ stop: () => {} })}>
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
it("web preview closes independently and switching pins never fetches or opens detail", async () => {
  await render(false);
  boundary.page.mockResolvedValue({ items, nextPageToken: null });
  await act(async () => { await controller.confirm({ query: "원문", kind: "whole", generation: 0, session: null }); });
  const pin = (name: string) => [...host.querySelectorAll<HTMLButtonElement>("[data-marker]")].find(b => b.textContent === name)!;
  const calls = vi.mocked(apiFetch).mock.calls.length;
  await act(async () => pin("결과3").click());
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain("결과3");
  await act(async () => pin("결과4").click());
  expect(host.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain("결과4");
  expect(views()).toHaveLength(0);
  expect(apiFetch).toHaveBeenCalledTimes(calls);
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="미리보기 닫기"]')!.click());
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(usePlaceSearchStore.getState().items).toHaveLength(11);
  await act(async () => pin("결과4").click());
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain("결과4");
});
it("web specific autocomplete opens preview, then detail only through its arrow, including reopen", async () => {
  await render(false);
  await act(async () => { await controller.confirm({ query: "원문", kind: "specific", generation: 0,
    session: { sessionToken: "token", expiresAt: Date.now() + 60000 }, prediction: prediction("result-4") }); });
  expect(views()).toHaveLength(0);
  expect(host.querySelector('[data-search-place-preview]')?.textContent).toContain("결과4");
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="결과4 상세정보 보기"]')!.click());
  expect(views()).toHaveLength(1);
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="닫기"]')!.click());
  const marker = [...host.querySelectorAll<HTMLButtonElement>("[data-marker]")].find(b => b.textContent === "결과4")!;
  await act(async () => marker.click());
  expect(host.querySelector('[data-search-place-preview]')).not.toBeNull();
  expect(views()).toHaveLength(1);
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="결과4 상세정보 보기"]')!.click());
  expect(views()).toHaveLength(2);
  expect(views().at(-1)![1].rank_bucket).toBeUndefined();
});

it("web pins preview Text Search data without fetching detail; arrow opens detail with original rank", async () => {
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
  expect(usePlaceSearchStore.getState().items[0].googlePlaceId).toBe("result-1");
  expect(views()).toHaveLength(0);
  for (const [number, rank] of [
    [3, "1_3"],
    [4, "4_10"],
    [11, "11_plus"],
  ] as const) {
    const marker = [
      ...host.querySelectorAll<HTMLButtonElement>("[data-marker]"),
    ].find((button) => button.textContent === `결과${number}`)!;
    const viewCount = views().length;
    const requestCount = vi.mocked(apiFetch).mock.calls.length;
    await act(async () => marker.click());
    expect(views()).toHaveLength(viewCount);
    expect(apiFetch).toHaveBeenCalledTimes(requestCount);
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain(`결과${number}`);
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain("4.3");
    await act(async () => host.querySelector<HTMLButtonElement>(`[aria-label="결과${number} 상세정보 보기"]`)!.click());
    expect(views().at(-1)![1]).toMatchObject({
      interaction_source: "search",
      rank_bucket: rank,
    });
    expectPrivateFieldsAbsent(views().at(-1)![1]);
  }
});
it("web resolved recommendation never auto-opens even when it is a Text Search result", async () => {
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
  expect(views()).toHaveLength(0);
  expect(usePlaceSearchStore.getState().selectedId).toBeNull();
});
it("web map-center fallback shows only pins without auto-selection", async () => {
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
  expect(views()).toHaveLength(0);
  expect(usePlaceSearchStore.getState().selectedId).toBeNull();
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

it("failed Text Search does not expose its anchor or emit a detail view", async () => {
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
  expect(views()).toHaveLength(0);
});

it("cancelling pending search cannot add late pins or detail views", async () => {
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
  await act(async () => controller.invalidate());
  expect(views()).toHaveLength(0);
  await act(async () => {
    finish({ items, nextPageToken: null });
    await pending;
  });
  expect(views()).toHaveLength(0);
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
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="결과4 상세정보 보기"]')!.click());
  expect(views().at(-1)![1].rank_bucket).toBe("4_10");
  await act(async () =>
    host.querySelector<HTMLButtonElement>("[data-general-poi]")!.click(),
  );
  expect(views().at(-1)![1].interaction_source).toBe("map");
  expect(views().at(-1)![1].rank_bucket).toBeUndefined();
  expectPrivateFieldsAbsent(views().at(-1)![1]);
});

it("discover ownership cancels pending search without showing its anchor", async () => {
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
  expect(host.textContent).not.toContain("결과1");
  await act(async () => useMapPinsFocusStore.getState().claimFocus("discover"));
  expect(views()).toHaveLength(0);
  expect(host.textContent).not.toContain("결과1");
  await act(async () => {
    finish({ items, nextPageToken: null });
    await pending;
  });
  expect(views()).toHaveLength(0);
  expect(usePlaceSearchStore.getState().items).toEqual([]);
  expect(
    boundary.track.mock.calls.filter(
      ([event]) => event === "view_search_results",
    ),
  ).toHaveLength(0);
});

it("selected preview label receives marker priority and transfers it to the next selection", async () => {
  await render(false);
  boundary.page.mockResolvedValue({ items, nextPageToken: null });
  await act(async () => { await controller.confirm({ query: "카페", kind: "whole", session: null, generation: 0 }); });
  const markers = () => [...host.querySelectorAll<HTMLButtonElement>("[data-marker]")];
  const first = () => markers().find(el => el.textContent === "결과1")!;
  const second = () => markers().find(el => el.textContent === "결과2")!;
  await act(async () => first().click());
  expect(Number(first().dataset.priority)).toBeGreaterThan(Number(second().dataset.priority || 0));
  expect(host.querySelector("[data-search-place-preview]")?.textContent).toContain("결과1");
  await act(async () => second().click());
  expect(Number(second().dataset.priority)).toBeGreaterThan(Number(first().dataset.priority || 0));
  expect(host.querySelector("[data-search-place-preview]")?.textContent).toContain("결과2");
});
