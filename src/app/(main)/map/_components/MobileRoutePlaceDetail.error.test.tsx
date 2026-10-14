// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { MobileRoutePlaceDetail } from "./MobileRoutePlaceDetail";
const boundary = vi.hoisted(() => ({
  tabs: vi.fn(),
  retry: vi.fn(),
  track: vi.fn(),
}));
vi.mock("@/hooks/useAnalyticsRoomId", () => ({
  useAnalyticsRoomId: () => "room",
}));
vi.mock("@/components/place/usePlaceDetailData", () => ({
  usePlaceDetailData: () => ({
    isLoading: false,
    isError: true,
    refetch: boundary.retry,
  }),
}));
vi.mock("@/components/place/HeroSection", () => ({
  HeroImage: () => null,
  HeroSkeleton: () => null,
}));
vi.mock("@/components/place/PlaceDetailTabs", () => ({
  PlaceDetailTabs: (props: unknown) => {
    boundary.tabs(props);
    return <p>리뷰 없음</p>;
  },
}));
vi.mock("@/lib/analytics/track", () => ({
  AnalyticsEvents: { viewPlace: "view_place" },
  trackAnalyticsEvent: boundary.track,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
it("failed full Details is retryable and never represented as no reviews or a successful view", async () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <MobileRoutePlaceDetail
        place={{ googlePlaceId: "one", title: "카페" }}
        active
        analyticsSource="search"
      />,
    ),
  );
  expect(boundary.tabs).not.toHaveBeenCalled();
  expect(boundary.track).not.toHaveBeenCalled();
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
  await act(async () => host.querySelector("button")!.click());
  expect(boundary.retry).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
});
