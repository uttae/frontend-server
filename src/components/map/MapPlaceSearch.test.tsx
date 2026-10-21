// @vitest-environment jsdom
import { apiFetch } from "@/lib/api/client";
vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn() }));
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { MapPlaceSearch } from "./MapPlaceSearch";
import { useMapCenterStore } from "@/stores/map-center-store";
import { usePlaceSearchStore } from "@/stores/place-search-store";
import { useSessionStore } from "@/stores/session-store";
const boundary = vi.hoisted(() => ({
  suggestions: vi.fn(),
  page: vi.fn(),
  select: vi.fn(),
  fetchFields: vi.fn(),
}));
const library = {};
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@vis.gl/react-google-maps", () => ({ useMapsLibrary: () => library }));
vi.mock("@/hooks/useSessionUser", () => ({
  useSessionUser: () => ({ data: { id: 7 } }),
}));
vi.mock("@/contexts/SelectedPlaceContext", () => ({
  useSelectedPlace: () => ({
    selectedPlace: null,
    setSelectedPlace: boundary.select,
  }),
}));
vi.mock("@/hooks/usePlacesSearch", () => ({
  fetchPlacesPageWithPhotos: boundary.page,
}));
vi.mock("@/lib/analytics/track", () => ({
  AnalyticsEvents: { search: "search" },
  trackAnalyticsEvent: vi.fn(),
}));
let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  vi.clearAllMocks();
});
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
it("specific Details failure retry returns to that input with a fresh session and never Text Search", async () => {
  const prediction = { placeId: "chosen", text: { text: "추천 장소 주소", matches: null }, structuredFormat: { mainText: { text: "추천 장소", matches: null }, secondaryText: { text: "주소", matches: null } } };
  let tokens = 0, resolves = 0;
  vi.mocked(apiFetch).mockReset().mockImplementation(async url => {
    if (String(url).endsWith("/places/sessions")) return Response.json({ sessionToken: `token-${++tokens}`, expiresAt: Date.now()+60000 }, { status: 201 });
    if (String(url).endsWith("/places/autocomplete")) return Response.json({ suggestions: [{ placePrediction: prediction }] });
    if (String(url).endsWith("/places/resolve")) {
      if (++resolves === 1) return Response.json({ code: "EXTERNAL_API_ERROR", message: "장소 정보 실패" }, { status: 502 });
      return Response.json({ detail: { googlePlaceId: "chosen", name: "추천 장소", formattedAddress: "주소", location: { lat: 1, lng: 2 }, primaryType: null, primaryTypeDisplayName: null, rating: null, userRatingCount: null, phoneNumber: null, websiteUri: null, googleMapsUri: null, googleMapsLinks: null, regularOpeningHours: null, reviews: [] }, source: "GOOGLE", cacheStatus: "MISS", googleDetailsRequested: true, termination: "SUCCEEDED" });
    }
    throw new Error(`Unexpected HTTP ${String(url)}`);
  });
  const autocompleteCalls = () => vi.mocked(apiFetch).mock.calls.filter(([url]) => String(url).endsWith("/places/autocomplete"));
  boundary.page.mockResolvedValue({ items: [], nextPageToken: null });
  useSessionStore.setState({ currentRoomId: "room" });
  useMapCenterStore.setState({ mapCenter: { lat: 1, lng: 2 } });
  usePlaceSearchStore.getState().clear();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  cleanup = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  await act(async () => root.render(<MapPlaceSearch mobile={false} />));
  await act(async () => (host.querySelector('button[aria-label="장소 검색 열기"]') as HTMLButtonElement).click());
  const input = host.querySelector("input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, "원래 검색어");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 280));
  });
  const token = JSON.parse(autocompleteCalls()[0][1]!.body as string).sessionToken;
  await act(async () => {
    const buttons = host.querySelectorAll('[role="option"] button');
    (buttons[1] as HTMLButtonElement).click();
  });
  expect(usePlaceSearchStore.getState().status).toBe("error");
  const retry = [...host.querySelectorAll("button")].find(
    (button) => button.textContent === "다시 시도",
  )!;
  await act(async () => retry.click());
  expect(boundary.page).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(input);
  expect(input.value).toBe("원래 검색어");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 280));
  });
  expect(JSON.parse(autocompleteCalls().at(-1)![1]!.body as string).sessionToken).not.toBe(
    token,
  );
  await act(async () => {
    (
      host.querySelectorAll('[role="option"] button')[1] as HTMLButtonElement
    ).click();
  });
  expect(resolves).toBe(2);
  expect(boundary.page).not.toHaveBeenCalled();
  expect(usePlaceSearchStore.getState().selectedId).toBe("chosen");
});
