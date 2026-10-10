import { afterEach, describe, expect, it, vi } from "vitest";

const analyticsRuntime = vi.hoisted(() => ({
  debugMode: false,
  enabled: true,
  measurementId: "G-TEST123",
}));

vi.mock("@/lib/analytics/runtime", () => ({
  analyticsRuntime,
}));

async function freshClient(consent: "granted" | "denied") {
  vi.resetModules();
  const dataLayer: unknown[] = [];
  vi.stubGlobal("window", { dataLayer });
  vi.stubGlobal("document", {
    cookie: `uttae_analytics_consent=v1:${consent}`,
  });
  const client = await import("@/lib/analytics/client");
  return { client, dataLayer };
}

function dataLayerCommands(dataLayer: readonly unknown[]): unknown[][] {
  return dataLayer.map((command) =>
    Array.from(command as ArrayLike<unknown>),
  );
}

afterEach(() => {
  analyticsRuntime.enabled = true;
  vi.unstubAllGlobals();
});

function createUnpersistedCookieDocument(initialCookie: string) {
  const cookie = initialCookie;

  return {
    get cookie() {
      return cookie;
    },
    set cookie(_value: string) {},
  };
}

describe("buildGoogleAnalyticsConfig", () => {
  it("always disables automatic page views", async () => {
    const { client } = await freshClient("granted");
    expect(client.buildGoogleAnalyticsConfig(false)).toEqual({
      send_page_view: false,
    });
  });

  it("marks explicitly enabled debug traffic", async () => {
    const { client } = await freshClient("granted");
    expect(client.buildGoogleAnalyticsConfig(true)).toEqual({
      debug_mode: true,
      send_page_view: false,
    });
  });
});

describe("Google Consent Mode", () => {
  it("keeps advertising denied for both analytics choices", async () => {
    const { client } = await freshClient("granted");
    expect(client.buildGoogleAnalyticsConsentState("granted")).toEqual({
      ad_personalization: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      analytics_storage: "granted",
    });
    expect(
      client.buildGoogleAnalyticsConsentState("denied").analytics_storage,
    ).toBe("denied");
  });

  it("queues default, granted update, js, and config in order", async () => {
    const { client, dataLayer } = await freshClient("granted");

    client.initializeGoogleAnalytics("G-TEST123", false);

    expect(dataLayerCommands(dataLayer)).toEqual([
      [
        "consent",
        "default",
        client.buildGoogleAnalyticsConsentState("denied"),
      ],
      [
        "consent",
        "update",
        client.buildGoogleAnalyticsConsentState("granted"),
      ],
      ["js", expect.any(Date)],
      ["config", "G-TEST123", { send_page_view: false }],
    ]);
  });

  it("queues gtag commands as native Arguments objects", async () => {
    const { client, dataLayer } = await freshClient("granted");

    client.initializeGoogleAnalytics("G-TEST123", false);

    expect(Array.isArray(dataLayer[0])).toBe(false);
    expect(Object.prototype.toString.call(dataLayer[0])).toBe(
      "[object Arguments]",
    );
    expect(dataLayerCommands(dataLayer)[0]).toEqual([
      "consent",
      "default",
      client.buildGoogleAnalyticsConsentState("denied"),
    ]);
  });

  it("holds data commands until consent initialization finishes", async () => {
    vi.resetModules();
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", {
      cookie: "uttae_analytics_consent=v1:granted",
    });
    const client = await import("@/lib/analytics/client");
    const { AnalyticsEvents, setAnalyticsUserId, trackAnalyticsEvent } =
      await import("@/lib/analytics/track");

    trackAnalyticsEvent(AnalyticsEvents.expenseCreated, { room_id: "test-room" });
    client.trackAnalyticsPageView({
      page_location:
        "https://example.com/search?utm_source=newsletter&utm_campaign=summer",
      page_path: "/search",
      page_referrer: "",
      page_title: "검색",
    });
    setAnalyticsUserId(42);

    expect(window.dataLayer).toBeUndefined();
    expect(window.gtag).toBeUndefined();

    client.initializeGoogleAnalytics("G-TEST123", false);

    expect(dataLayerCommands(window.dataLayer ?? [])).toEqual([
      [
        "consent",
        "default",
        client.buildGoogleAnalyticsConsentState("denied"),
      ],
      [
        "consent",
        "update",
        client.buildGoogleAnalyticsConsentState("granted"),
      ],
      ["js", expect.any(Date)],
      ["config", "G-TEST123", { send_page_view: false }],
      ["event", "expense_created", {}],
      [
        "event",
        "page_view",
        expect.objectContaining({
          page_location:
            "https://example.com/search?utm_source=newsletter&utm_campaign=summer",
          page_path: "/search",
        }),
      ],
      ["set", { user_id: "42" }],
    ]);
  });

  it("discards a direct data command denied before initialization", async () => {
    vi.resetModules();
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", {
      cookie: "uttae_analytics_consent=v1:denied",
    });
    const client = await import("@/lib/analytics/client");

    client.sendAnalyticsDataCommand("event", "expense_created");
    expect(window.dataLayer).toBeUndefined();
    expect(window.gtag).toBeUndefined();

    document.cookie = "uttae_analytics_consent=v1:granted";
    client.initializeGoogleAnalytics("G-TEST123", false);

    expect(dataLayerCommands(window.dataLayer ?? [])).not.toContainEqual([
      "event",
      "expense_created",
    ]);
  });

  it("rechecks the runtime gate before flushing held data commands", async () => {
    const { client, dataLayer } = await freshClient("granted");

    client.sendAnalyticsDataCommand(
      "event",
      "expense_created",
    );
    analyticsRuntime.enabled = false;
    client.initializeGoogleAnalytics("G-TEST123", false);

    expect(dataLayerCommands(dataLayer)).not.toContainEqual([
      "event",
      "expense_created",
    ]);
  });

  it("blocks direct data commands while the analytics runtime is disabled", async () => {
    analyticsRuntime.enabled = false;
    const { client, dataLayer } = await freshClient("granted");
    client.initializeGoogleAnalytics("G-TEST123", false);
    dataLayer.length = 0;

    client.sendAnalyticsDataCommand("event", "expense_created");

    expect(dataLayer).toEqual([]);
  });

  it("discards held data commands when consent is denied before initialization", async () => {
    vi.resetModules();
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", {
      cookie: "uttae_analytics_consent=v1:granted",
    });
    const client = await import("@/lib/analytics/client");
    const { AnalyticsEvents, trackAnalyticsEvent } = await import(
      "@/lib/analytics/track"
    );

    trackAnalyticsEvent(AnalyticsEvents.expenseCreated, { room_id: "test-room" });
    client.revokeGoogleAnalyticsConsent();

    expect(window.dataLayer).toBeUndefined();
    expect(window.gtag).toBeUndefined();

    client.initializeGoogleAnalytics("G-TEST123", false);

    expect(dataLayerCommands(window.dataLayer ?? [])).toEqual([
      [
        "consent",
        "default",
        client.buildGoogleAnalyticsConsentState("denied"),
      ],
      [
        "consent",
        "update",
        client.buildGoogleAnalyticsConsentState("granted"),
      ],
      ["js", expect.any(Date)],
      ["config", "G-TEST123", { send_page_view: false }],
    ]);
  });

  it("clears user id and denies storage, then re-grants without duplicate config", async () => {
    const { client, dataLayer } = await freshClient("granted");
    client.initializeGoogleAnalytics("G-TEST123", false);
    dataLayer.length = 0;

    client.revokeGoogleAnalyticsConsent();
    client.initializeGoogleAnalytics("G-TEST123", false);

    expect(dataLayerCommands(dataLayer)).toEqual([
      ["set", { user_id: null }],
      [
        "consent",
        "update",
        client.buildGoogleAnalyticsConsentState("denied"),
      ],
      [
        "consent",
        "update",
        client.buildGoogleAnalyticsConsentState("granted"),
      ],
    ]);
  });

  it("does not create gtag when rejecting before analytics initialization", async () => {
    const { client, dataLayer } = await freshClient("denied");
    client.revokeGoogleAnalyticsConsent();
    expect(dataLayer).toEqual([]);
    expect(window.gtag).toBeUndefined();
  });

  it("blocks page views unless consent is granted", async () => {
    const { client, dataLayer } = await freshClient("denied");
    client.trackAnalyticsPageView({
      page_location: "https://example.com/search",
      page_path: "/search",
      page_referrer: "",
      page_title: "검색",
    });
    expect(dataLayer).toEqual([]);

    document.cookie = "uttae_analytics_consent=v1:granted";
    client.initializeGoogleAnalytics("G-TEST123", false);
    dataLayer.length = 0;
    client.trackAnalyticsPageView({
      page_location: "https://example.com/search",
      page_path: "/search",
      page_referrer: "",
      page_title: "검색",
    });
    expect(dataLayerCommands(dataLayer)).toEqual([
      [
        "event",
        "page_view",
        expect.objectContaining({ page_path: "/search" }),
      ],
    ]);
  });

  it("uses denied session state when a stale granted cookie cannot persist", async () => {
    vi.resetModules();
    const dataLayer: unknown[] = [];
    const cookieDocument = createUnpersistedCookieDocument(
      "uttae_analytics_consent=v1:granted",
    );
    vi.stubGlobal("window", {
      dataLayer,
      location: { hostname: "example.com", protocol: "http:" },
    });
    vi.stubGlobal("document", cookieDocument);
    const { analyticsConsentStore } = await import(
      "@/lib/analytics/consent-store"
    );
    const client = await import("@/lib/analytics/client");

    expect(analyticsConsentStore.set("denied")).toEqual({
      persisted: false,
      state: "denied",
    });
    client.trackAnalyticsPageView({
      page_location: "https://example.com/search",
      page_path: "/search",
      page_referrer: "",
      page_title: "검색",
    });

    expect(dataLayer).toEqual([]);
  });
});
