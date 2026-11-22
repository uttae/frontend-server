import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const consentState = vi.hoisted(() => ({
  value: "granted" as "denied" | "granted" | "pending",
}));

vi.mock("@/components/analytics/AmplitudeAnalytics", () => ({
  AmplitudeAnalytics: () => <div data-amplitude-analytics />,
}));

vi.mock("@/components/analytics/CookieConsentBanner", () => ({
  CookieConsentBanner: () => null,
}));

vi.mock("@/components/analytics/GoogleAnalyticsScript", () => ({
  GoogleAnalyticsScript: () => <div data-google-analytics />,
}));

vi.mock("@/lib/analytics/consent-actions", () => ({
  denyAnalyticsConsent: vi.fn(),
  grantAnalyticsConsent: vi.fn(),
}));

vi.mock("@/lib/analytics/consent-store", () => ({
  analyticsConsentStore: {
    getServerSnapshot: () => consentState.value,
    getSnapshot: () => consentState.value,
    subscribe: () => () => {},
  },
}));

import { ConsentGatedAnalytics } from "@/components/analytics/ConsentGatedAnalytics";

function renderAnalyticsGate() {
  return renderToStaticMarkup(
    <ConsentGatedAnalytics debugMode={false} gaId="">
      <div data-route-tracker />
    </ConsentGatedAnalytics>,
  );
}

describe("Amplitude consent gate", () => {
  beforeEach(() => {
    consentState.value = "granted";
  });

  it("mounts the Amplitude client after analytics consent is granted", () => {
    expect(renderAnalyticsGate()).toContain("data-amplitude-analytics");
  });

  it.each(["pending", "denied"] as const)("does not mount the Amplitude client while consent is %s", (consent) => {
    consentState.value = consent;

    expect(renderAnalyticsGate()).not.toContain("data-amplitude-analytics");
  });
});
