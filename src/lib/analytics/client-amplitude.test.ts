import { afterEach, expect, it, vi } from "vitest";

const sendAmplitudeDataCommand = vi.hoisted(() => vi.fn());

vi.mock("@/lib/analytics/amplitude", () => ({
  sendAmplitudeDataCommand,
}));

vi.mock("@/lib/analytics/runtime", () => ({
  analyticsRuntime: {
    debugMode: false,
    enabled: false,
    measurementId: null,
  },
}));

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it("forwards consented key interactions to Amplitude without GA configuration", async () => {
  vi.stubGlobal("window", {});
  vi.stubGlobal("document", {
    cookie: "uttae_analytics_consent=v1:granted",
  });
  const client = await import("@/lib/analytics/client");

  client.sendAnalyticsDataCommand("event", "create_plan", { days: 3 });

  expect(sendAmplitudeDataCommand).toHaveBeenCalledWith("event", "create_plan", { days: 3 });
});
