// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { MapPlaceSearchInput } from "@/components/search/MapPlaceSearchInput";
import { useMapPlaceSearch } from "./useMapPlaceSearch";
import { usePlaceSearchStore } from "@/stores/place-search-store";
import { useMapCenterStore } from "@/stores/map-center-store";
import { useSessionStore } from "@/stores/session-store";
import { apiFetch } from "@/lib/api/client";
import { placeDetailQueryKey } from "@/lib/places/place-queries";
import { registerQueryClient } from "@/lib/query-client";
import { usePlaceDetailData } from "@/components/place/usePlaceDetailData";
import { HomeTab } from "@/components/place/HomeTab";
import { ReviewsTab } from "@/components/place/ReviewsTab";
const external = vi.hoisted(() => ({ select: vi.fn(), track: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn() }));
vi.mock("@/contexts/SelectedPlaceContext", () => ({ useSelectedPlace: () => ({ setSelectedPlace: external.select }) }));
vi.mock("@/hooks/useSessionUser", () => ({ useSessionUser: () => ({ data: { id: 7 } }) }));
vi.mock("@/lib/analytics/track", () => ({ AnalyticsEvents: { search: "search" }, trackAnalyticsEvent: external.track }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const detail = {
  googlePlaceId: "chosen", name: "서버 카페", formattedAddress: "서버 주소", location: { lat: 37, lng: 127 },
  primaryType: "cafe", primaryTypeDisplayName: "카페", rating: 4.8, userRatingCount: 5,
  phoneNumber: "02-123-4567", websiteUri: "https://example.com", googleMapsUri: null,
  googleMapsLinks: { placeUri: "https://maps.google.com/place", directionsUri: null, writeAReviewUri: null, reviewsUri: "https://maps.google.com/reviews", photosUri: null },
  regularOpeningHours: { openNow: true, secondaryHoursType: null, specialDays: [], periods: [], weekdayDescriptions: ["월요일 9시"], nextOpenTime: null, nextCloseTime: null },
  reviews: [{ rating: 5, text: "서버 리뷰", authorDisplayName: "작성자", publishTime: "2026-01-01", relativePublishTimeDescription: "최근" }],
};
let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => { await cleanup?.(); vi.useRealTimers(); });
it.each(["MISS", "HIT"] as const)("%s selected card and panels reuse complete resolve DTO with exact HTTP counts", async cacheStatus => {
  vi.useFakeTimers();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); registerQueryClient(client);
  if (cacheStatus === "HIT") client.setQueryData(placeDetailQueryKey("chosen"), { ...detail, name: "이전 캐시" });
  useSessionStore.setState({ currentRoomId: "room" }); usePlaceSearchStore.getState().clear();
  useMapCenterStore.setState({ mapCenter: { lat: 1, lng: 2 } }); external.track.mockClear();
  vi.mocked(apiFetch).mockReset().mockImplementation(async (url, init) => {
    if (String(url).endsWith("/places/sessions")) return Response.json({ sessionToken: "server-uuid", expiresAt: Date.now()+1800000 }, { status: 201 });
    if (String(url).endsWith("/places/autocomplete")) {
      expect(JSON.parse(init!.body as string)).toEqual({ sessionToken: "server-uuid", input: "원문", latitude: 1, longitude: 2 });
      return Response.json({ suggestions: [{ placePrediction: { placeId: "chosen", text: null, structuredFormat: { mainText: { text: "SDK 아님", matches: null }, secondaryText: null } } }] });
    }
    if (String(url).endsWith("/places/resolve")) {
      expect(JSON.parse(init!.body as string)).toEqual({ sessionToken: "server-uuid", googlePlaceId: "chosen" });
      return Response.json({ detail, cacheStatus, source: cacheStatus === "HIT" ? "CACHE" : "GOOGLE", googleDetailsRequested: cacheStatus === "MISS", termination: cacheStatus === "MISS" ? "SUCCEEDED" : "NOT_TERMINATED" });
    }
    throw new Error(`Unexpected supplement HTTP: ${String(url)}`);
  });
  function Panel({ id }: { id: string }) {
    const { data } = usePlaceDetailData(id);
    return data ? <><h3>{data.name}</h3><HomeTab address={data.formattedAddress} phone={data.phone} website={data.websiteUri} hours={data.weekdayDescriptions.join("\n")} isOpen={data.openNow} googleMapsUrl={data.placeUri ?? undefined}/><ReviewsTab rating={data.rating} reviews={data.reviews} reviewsUri={data.reviewsUri}/></> : null;
  }
  function App() {
    const controller = useMapPlaceSearch(true);
    const state = usePlaceSearchStore();
    return <><MapPlaceSearchInput mobile onConfirm={controller.confirm} onInvalidate={controller.invalidate} scopeKey={controller.scopeKey}/><div data-card>{state.items[0]?.name}</div>{state.expanded && state.selectedId ? <Panel id={state.selectedId}/> : null}</>;
  }
  const host = document.createElement("div"); const root = createRoot(host);
  cleanup = async () => { await act(async () => root.unmount()); client.clear(); };
  await act(async () => root.render(<QueryClientProvider client={client}><App/></QueryClientProvider>));
  await act(async () => {
    const input = host.querySelector("input")!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "원문");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => vi.advanceTimersByTimeAsync(250));
  await act(async () => (host.querySelectorAll('[role="option"] button')[1] as HTMLButtonElement).click());
  expect(host.querySelector("[data-card]")?.textContent).toBe("서버 카페");
  expect(apiFetch).toHaveBeenCalledTimes(3); // issuance + autocomplete + resolve, no TextSearch or GET detail
  const raw = client.getQueryData(placeDetailQueryKey("chosen")); expect(raw).toEqual(detail);
  expect(raw).not.toHaveProperty("reviewSummary");
  await act(async () => usePlaceSearchStore.getState().setExpanded(true));
  expect(host.textContent).toContain("서버 리뷰"); expect(host.textContent).toContain("월요일 9시");
  expect(host.querySelector('a[href="tel:02-123-4567"]')).not.toBeNull();
  expect(host.querySelector('a[href="https://maps.google.com/place"]')).not.toBeNull();
  await act(async () => usePlaceSearchStore.getState().setExpanded(false));
  await act(async () => usePlaceSearchStore.getState().setExpanded(true));
  expect(apiFetch).toHaveBeenCalledTimes(3); expect(client.getQueryData(placeDetailQueryKey("chosen"))).toBe(raw);
  expect(external.track).not.toHaveBeenCalled();
});
