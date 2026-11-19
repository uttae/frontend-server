import { describe, expect, it } from "vitest";

import { resolveAnalyticsRuntime } from "@/lib/analytics/runtime";

describe("resolveAnalyticsRuntime", () => {
  it("enables a valid GA4 measurement ID in production", () => {
    expect(
      resolveAnalyticsRuntime({
        debugMode: undefined,
        measurementId: " G-ABC123 ",
        nodeEnv: "production",
      }),
    ).toEqual({
      debugMode: false,
      enabled: true,
      measurementId: "G-ABC123",
    });
  });

  it("keeps analytics disabled outside production by default", () => {
    expect(
      resolveAnalyticsRuntime({
        debugMode: undefined,
        measurementId: "G-ABC123",
        nodeEnv: "development",
      }),
    ).toEqual({
      debugMode: false,
      enabled: false,
      measurementId: "G-ABC123",
    });
  });

  it("allows an explicit debug stream outside production", () => {
    expect(
      resolveAnalyticsRuntime({
        debugMode: "true",
        measurementId: "G-DEBUG123",
        nodeEnv: "development",
      }),
    ).toEqual({
      debugMode: true,
      enabled: true,
      measurementId: "G-DEBUG123",
    });
  });

  it.each([undefined, "", "UA-123", "G-invalid id"])("rejects an invalid measurement ID: %s", (measurementId) => {
    expect(
      resolveAnalyticsRuntime({
        debugMode: "true",
        measurementId,
        nodeEnv: "production",
      }),
    ).toEqual({
      debugMode: true,
      enabled: false,
      measurementId: null,
    });
  });
});
