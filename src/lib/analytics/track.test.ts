import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  AnalyticsEvents,
  type AnalyticsEventParamsMap,
  buildAnalyticsUserIdCommand,
  buildTutorialExitAnalyticsEvent,
  trackAnalyticsEvent,
} from "@/lib/analytics/track";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function dataLayerCommands(dataLayer: readonly unknown[]): unknown[][] {
  return dataLayer.map((command) =>
    Array.from(command as ArrayLike<unknown>),
  );
}

describe("AnalyticsEvents", () => {
  it("exposes the frontend GA event schema", () => {
    expect(AnalyticsEvents).toEqual({
      ctaClick: "cta_click",
      sectionView: "section_view",
      signUp: "sign_up",
      login: "login",
      createBookmarkFolder: "create_bookmark_folder",
      addToBookmark: "add_to_bookmark",
      createPlan: "create_plan",
      viewPlan: "view_plan",
      inviteView: "invite_view",
      joinPlan: "join_group",
      viewPlace: "view_place",
      addToItinerary: "add_to_itinerary",
      removeFromItinerary: "remove_from_itinerary",
      reorderItinerary: "reorder_itinerary",
      search: "view_search_results",
      sharePlan: "share",
      chatMessageSent: "chat_message_sent",
      tutorialBegin: "tutorial_begin",
      tutorialComplete: "tutorial_complete",
      tutorialSkip: "tutorial_skip",
    });
  });

  it("keeps search-result analytics free of raw search terms", () => {
    type SearchResultParams =
      AnalyticsEventParamsMap[typeof AnalyticsEvents.search];

    expectTypeOf<SearchResultParams>().toEqualTypeOf<{
      result_count_bucket: "0" | "1_5" | "6_20" | "21_plus";
      search_mode: "map_recenter" | "text";
    }>();
  });

  it("reserves source and exposes interaction_source for product interactions", () => {
    type EventWithReservedSource = {
      [EventName in keyof AnalyticsEventParamsMap]:
        AnalyticsEventParamsMap[EventName] extends undefined
          ? never
          : "source" extends keyof AnalyticsEventParamsMap[EventName]
            ? EventName
            : never;
    }[keyof AnalyticsEventParamsMap];

    expectTypeOf<EventWithReservedSource>().toEqualTypeOf<never>();
    expectTypeOf<
      AnalyticsEventParamsMap[typeof AnalyticsEvents.addToItinerary]
    >().toEqualTypeOf<{
      interaction_source: "bookmark" | "chat" | "map" | "plan" | "search";
      item_count_bucket: "0" | "1" | "2_3" | "4_7" | "8_plus";
      place_category?: string;
    }>();
  });

  it("does not require browser URL context during SSR", () => {
    expect(() =>
      trackAnalyticsEvent(AnalyticsEvents.createBookmarkFolder),
    ).not.toThrow();
  });
});

describe("buildTutorialExitAnalyticsEvent", () => {
  it("builds the recommended completion event", () => {
    expect(buildTutorialExitAnalyticsEvent("complete", 5)).toEqual({
      eventName: "tutorial_complete",
      params: { tutorial_version: "sidebar_v1" },
    });
  });

  it("builds a skip event with the visible one-based step", () => {
    expect(buildTutorialExitAnalyticsEvent("skip", 2)).toEqual({
      eventName: "tutorial_skip",
      params: {
        skip_step: "3",
        tutorial_version: "sidebar_v1",
      },
    });
  });

  it.each([-1, 5])("rejects an invalid skip step index: %i", (stepIndex) => {
    expect(() =>
      buildTutorialExitAnalyticsEvent("skip", stepIndex),
    ).toThrow(RangeError);
  });
});

describe("buildAnalyticsUserIdCommand", () => {
  it("sets an opaque string user ID for an authenticated user", () => {
    expect(buildAnalyticsUserIdCommand(42)).toEqual([
      "set",
      { user_id: "42" },
    ]);
  });

  it.each([null, undefined, 0, Number.NaN])(
    "clears the user ID for an invalid or signed-out value: %s",
    (userId) => {
      expect(buildAnalyticsUserIdCommand(userId)).toEqual([
        "set",
        { user_id: null },
      ]);
    },
  );
});

describe("analytics consent gate", () => {
  it("blocks an event after denial and sends it after grant", async () => {
    vi.stubEnv("NEXT_PUBLIC_GA_DEBUG_MODE", "true");
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TEST123");
    const dataLayer: unknown[] = [];
    vi.stubGlobal("window", { dataLayer });
    vi.stubGlobal("document", {
      cookie: "uttae_analytics_consent=v1:denied",
    });
    vi.resetModules();
    const { AnalyticsEvents, trackAnalyticsEvent } = await import(
      "@/lib/analytics/track"
    );
    const { initializeGoogleAnalytics } = await import(
      "@/lib/analytics/client"
    );

    trackAnalyticsEvent(AnalyticsEvents.createBookmarkFolder);
    expect(window.dataLayer).toEqual([]);

    document.cookie = "uttae_analytics_consent=v1:granted";
    initializeGoogleAnalytics("G-TEST123", false);
    dataLayer.length = 0;
    trackAnalyticsEvent(AnalyticsEvents.createBookmarkFolder);
    expect(dataLayerCommands(window.dataLayer ?? [])).toEqual([
      ["event", "create_bookmark_folder"],
    ]);
  });

  it("uses session state for general events when cookie persistence fails", async () => {
    vi.stubEnv("NEXT_PUBLIC_GA_DEBUG_MODE", "true");
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TEST123");
    const dataLayer: unknown[] = [];
    let staleCookie = "uttae_analytics_consent=v1:denied";
    vi.stubGlobal("window", {
      dataLayer,
      location: { hostname: "example.com", protocol: "http:" },
    });
    vi.stubGlobal("document", {
      get cookie() {
        return staleCookie;
      },
      set cookie(_value: string) {},
    });
    vi.resetModules();
    const { analyticsConsentStore } = await import(
      "@/lib/analytics/consent-store"
    );
    const { AnalyticsEvents, trackAnalyticsEvent } = await import(
      "@/lib/analytics/track"
    );
    const { initializeGoogleAnalytics } = await import(
      "@/lib/analytics/client"
    );

    expect(analyticsConsentStore.set("granted")).toEqual({
      persisted: false,
      state: "granted",
    });
    initializeGoogleAnalytics("G-TEST123", false);
    dataLayer.length = 0;
    trackAnalyticsEvent(AnalyticsEvents.createBookmarkFolder);
    expect(dataLayerCommands(dataLayer)).toEqual([
      ["event", "create_bookmark_folder"],
    ]);

    dataLayer.length = 0;
    staleCookie = "uttae_analytics_consent=v1:granted";
    expect(analyticsConsentStore.set("denied")).toEqual({
      persisted: false,
      state: "denied",
    });
    trackAnalyticsEvent(AnalyticsEvents.createBookmarkFolder);
    expect(dataLayer).toEqual([]);
  });

  it("gates user ID commands by pending, granted, and denied session state", async () => {
    vi.stubEnv("NEXT_PUBLIC_GA_DEBUG_MODE", "true");
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TEST123");
    const dataLayer: unknown[] = [];
    let staleCookie = "";
    vi.stubGlobal("window", {
      dataLayer,
      location: { hostname: "example.com", protocol: "http:" },
    });
    vi.stubGlobal("document", {
      get cookie() {
        return staleCookie;
      },
      set cookie(_value: string) {},
    });
    vi.resetModules();
    const { analyticsConsentStore } = await import(
      "@/lib/analytics/consent-store"
    );
    const { setAnalyticsUserId } = await import("@/lib/analytics/track");
    const { initializeGoogleAnalytics } = await import(
      "@/lib/analytics/client"
    );

    setAnalyticsUserId(42);
    expect(dataLayer).toEqual([]);

    expect(analyticsConsentStore.set("granted")).toEqual({
      persisted: false,
      state: "granted",
    });
    initializeGoogleAnalytics("G-TEST123", false);
    dataLayer.length = 0;
    setAnalyticsUserId(42);
    expect(dataLayerCommands(dataLayer)).toEqual([
      ["set", { user_id: "42" }],
    ]);

    dataLayer.length = 0;
    staleCookie = "uttae_analytics_consent=v1:granted";
    expect(analyticsConsentStore.set("denied")).toEqual({
      persisted: false,
      state: "denied",
    });
    setAnalyticsUserId(42);
    expect(dataLayer).toEqual([]);
  });
});
