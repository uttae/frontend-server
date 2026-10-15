// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { fetchPlaceDetail, placeDetailQueryKey } from "./place-queries";
import { confirmPlaceSearch } from "./search-session";
import { registerQueryClient } from "@/lib/query-client";
import { usePlaceDetailData } from "@/components/place/usePlaceDetailData";
import { apiFetch } from "@/lib/api/client";
vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn() }));
import { requestPlaceDetail, type PlaceDetail } from "@/lib/api/places";
vi.mock("@/lib/api/places", async (original) => ({
  ...(await original<object>()),
  requestPlaceDetail: vi.fn(),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
it("resolved full raw response seeds canonical cache and later panels reuse it with zero GET requests", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  registerQueryClient(client);
  const detail: PlaceDetail = {
    googlePlaceId: "one",
    name: "카페",
    formattedAddress: "주소",
    location: { lat: 1, lng: 2 },
    primaryType: "cafe",
    primaryTypeDisplayName: "카페",
    rating: 4.5,
    userRatingCount: 3,
    phoneNumber: "전화",
    websiteUri: "https://example.com",
    googleMapsUri: "https://maps.google.com",
    googleMapsLinks: {
      placeUri: "https://maps.google.com/place",
      reviewsUri: "https://maps.google.com/reviews",
      directionsUri: null,
      writeAReviewUri: null,
      photosUri: null,
    },
    regularOpeningHours: { openNow: true, weekdayDescriptions: ["월요일 9시"], secondaryHoursType: null, specialDays: [], periods: [], nextOpenTime: null, nextCloseTime: null },
    reviewSummary: "요약",
    reviews: [
      {
        rating: 5,
        text: "리뷰",
        authorDisplayName: "작성자",
        publishTime: "2026-01-01",
        relativePublishTimeDescription: "최근",
      },
    ],
  };
  vi.mocked(requestPlaceDetail).mockReset().mockResolvedValue(detail);
  vi.mocked(apiFetch).mockResolvedValue(Response.json({ detail, source: "GOOGLE", cacheStatus: "MISS", googleDetailsRequested: true, termination: "SUCCEEDED" }));
  await confirmPlaceSearch({ query: "카페", kind: "specific", prediction: { placeId: "one", text: null, structuredFormat: null }, session: { sessionToken: "token", expiresAt: Date.now()+60000 }, mapCenter: null, isCurrent: () => true, search: async () => [] });
  const cached = client.getQueryData(placeDetailQueryKey("one"));
  expect(cached).toEqual(detail);
  expect(await fetchPlaceDetail("places/one")).toBe(cached);
  let view: ReturnType<typeof usePlaceDetailData>;
  function Panel() {
    const result = usePlaceDetailData("one");
    useEffect(() => {
      view = result;
    });
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <Panel />
      </QueryClientProvider>,
    ),
  );
  expect(requestPlaceDetail).not.toHaveBeenCalled();
  expect(apiFetch).toHaveBeenCalledTimes(1);
  expect(view!.data).toMatchObject({
    openNow: true,
    phone: "전화",
    weekdayDescriptions: ["월요일 9시"],
    reviews: detail.reviews,
    placeUri: detail.googleMapsLinks!.placeUri,
  });
  await act(async () => root.unmount());
  client.clear();
});
