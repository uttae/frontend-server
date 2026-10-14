// @vitest-environment jsdom
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
vi.mock("@/lib/placesAutocompleteSuggest", () => ({
  AUTOCOMPLETE_SUGGEST_DEBOUNCE_MS: 1,
  newAutocompleteSessionToken: () => ({}),
  circleLocationBias: (center: unknown, radius: number) => ({ center, radius }),
  fetchPlacePredictionsForRequest: boundary.suggestions,
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
  const prediction = {
    placeId: "chosen",
    mainText: { text: "추천 장소" },
    secondaryText: { text: "주소" },
    text: { text: "추천 장소 주소" },
    toPlace: () => ({
      fetchFields: boundary.fetchFields,
      location: { lat: () => 1, lng: () => 2 },
    }),
  };
  boundary.fetchFields
    .mockRejectedValueOnce(new Error("장소 정보 실패"))
    .mockResolvedValue(undefined);
  boundary.suggestions.mockResolvedValue([prediction]);
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
  const input = host.querySelector("input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, "원래 검색어");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  const token = boundary.suggestions.mock.calls[0][0].sessionToken;
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
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  expect(boundary.suggestions.mock.calls.at(-1)![0].sessionToken).not.toBe(
    token,
  );
  await act(async () => {
    (
      host.querySelectorAll('[role="option"] button')[1] as HTMLButtonElement
    ).click();
  });
  expect(boundary.fetchFields).toHaveBeenCalledTimes(2);
  expect(boundary.page).not.toHaveBeenCalled();
  expect(usePlaceSearchStore.getState().selectedId).toBe("chosen");
});
