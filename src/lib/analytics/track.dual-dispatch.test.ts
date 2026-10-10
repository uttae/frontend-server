import { afterEach, describe, expect, it, vi } from "vitest";

const sendAmplitudeDataCommand = vi.hoisted(() => vi.fn());

vi.mock("@/lib/analytics/amplitude", () => ({
  revokeAmplitudeConsent: vi.fn(),
  sendAmplitudeDataCommand,
}));

vi.mock("@/lib/analytics/runtime", () => ({
  analyticsRuntime: {
    debugMode: false,
    enabled: true,
    measurementId: "G-TEST123",
  },
}));

function dataLayerCommands(dataLayer: readonly unknown[]): unknown[][] {
  return dataLayer.map((command) =>
    Array.from(command as ArrayLike<unknown>),
  );
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("custom product event URL context", () => {
  it.each([
    ["/plan/private-room-id", "/plan/[roomId]"],
    ["/join/private-invite-code", "/join/[inviteCode]"],
    ["/bookmark/private-folder-id", "/bookmark/[folderId]"],
    ["/privacy-settings", "/privacy-settings"],
  ] as const)(
    "sends the sanitized %s route to GA4 and Amplitude",
    async (pathname, expectedPath) => {
      const dataLayer: unknown[] = [];
      vi.stubGlobal("window", {
        dataLayer,
        location: {
          hash: "#private-fragment",
          origin: "https://uttae.example",
          pathname,
          search: "?q=private-query&utm_source=newsletter",
        },
      });
      vi.stubGlobal("document", {
        cookie: "uttae_analytics_consent=v1:granted",
      });

      const { initializeGoogleAnalytics } = await import(
        "@/lib/analytics/client"
      );
      const { AnalyticsEvents, trackAnalyticsEvent } = await import(
        "@/lib/analytics/track"
      );
      initializeGoogleAnalytics("G-TEST123", false);
      dataLayer.length = 0;
      sendAmplitudeDataCommand.mockClear();

      trackAnalyticsEvent(AnalyticsEvents.addToItinerary, {
        room_id: "target-room",
        interaction_source: "search",
        item_count_bucket: "1",
      });

      const expectedPayload = {
        interaction_source: "search",
        item_count_bucket: "1",
        page_location: `https://uttae.example${expectedPath}`,
        page_path: expectedPath,
      };
      expect(dataLayerCommands(dataLayer)).toEqual([
        ["event", "add_to_itinerary", expectedPayload],
      ]);
      expect(sendAmplitudeDataCommand).toHaveBeenCalledWith(
        "event",
        "add_to_itinerary",
        { ...expectedPayload, room_id: "target-room" },
      );
      expect(JSON.stringify(expectedPayload)).not.toMatch(
        /private-|[?#]|utm_source/,
      );
    },
  );
});
