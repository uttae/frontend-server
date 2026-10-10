import { afterEach, describe, expect, it, vi } from "vitest";

const analytics = vi.hoisted(() => ({
  setUserId: vi.fn(),
  trackPageView: vi.fn(),
}));

vi.mock("react", () => ({
  useEffect: (effect: () => void) => effect(),
  useRef: <T,>(initialValue: T) => ({ current: initialValue }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/search",
}));

vi.mock("@/hooks/useSessionUser", () => ({
  useSessionUser: () => ({
    data: { id: 42 },
    status: "success",
  }),
}));

vi.mock("@/lib/analytics/client", () => ({
  trackAnalyticsPageView: analytics.trackPageView,
}));

vi.mock("@/lib/analytics/track", () => ({
  setAnalyticsUserId: analytics.setUserId,
}));

vi.mock("@/lib/auth-session", () => ({
  shouldSkipReconcileClientSession: () => false,
}));

vi.mock("@/stores/session-store", () => ({
  useSessionStore: Object.assign(
    (selector: (state: { sessionReady: boolean; currentRoomId: string }) => unknown) =>
      selector({ sessionReady: true, currentRoomId: "room-a" }),
    { getState: () => ({ sessionReady: true, currentRoomId: "room-a" }) },
  ),
}));

import { AnalyticsRouteTracker } from "@/components/analytics/AnalyticsRouteTracker";
import { AnonymousAnalyticsRouteTracker } from "@/components/analytics/AnonymousAnalyticsRouteTracker";

function stubCampaignLocation() {
  vi.stubGlobal("window", {
    location: {
      origin: "https://example.com",
      search: "?utm_source=newsletter&q=private",
    },
  });
  vi.stubGlobal("document", {
    referrer: "",
    title: "검색",
  });
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("analytics route campaign attribution", () => {
  it("includes the current campaign search in authenticated page views", () => {
    stubCampaignLocation();

    AnalyticsRouteTracker();

    expect(analytics.trackPageView).toHaveBeenCalledWith({
      room_id: "room-a",
      page_location: "https://example.com/search?utm_source=newsletter",
      page_path: "/search",
      page_title: "검색",
    });
  });

  it("includes the current campaign search in anonymous page views", () => {
    stubCampaignLocation();

    AnonymousAnalyticsRouteTracker();

    expect(analytics.trackPageView).toHaveBeenCalledWith({
      page_location: "https://example.com/search?utm_source=newsletter",
      page_path: "/search",
      page_title: "검색",
    });
  });
});
