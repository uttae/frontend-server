// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({ initAll: vi.fn(async () => {}), track: vi.fn(), setUserId: vi.fn(), setOptOut: vi.fn() }));
vi.mock("@amplitude/unified", () => sdk);
vi.mock("./runtime", () => ({ analyticsRuntime: { enabled: true } }));
vi.mock("./amplitude-runtime", () => ({ amplitudeRuntime: { enabled: true, apiKey: "local-test", sessionReplaySampleRate: 0 } }));
afterEach(() => {
  document.cookie = "uttae_analytics_consent=; Max-Age=0; Path=/";
  delete window.gtag; delete window.dataLayer;
  vi.resetModules(); vi.clearAllMocks();
});
it("uses real consent/wrapper/queues with independent GA and Amplitude initialization and revoke", async () => {
  const { analyticsConsentStore: consent } = await import("./consent-store");
  const { denyAnalyticsConsent, grantAnalyticsConsent } = await import("./consent-actions");
  const { trackAnalyticsEvent, AnalyticsEvents } = await import("./track");
  const { initializeGoogleAnalytics } = await import("./client");
  const { initializeAmplitude } = await import("./amplitude");
  const cta = () => trackAnalyticsEvent(AnalyticsEvents.ctaClick, { page_type: "landing", cta_id: "login", cta_position: "header" });
  expect(consent.getSnapshot()).toBe("pending"); cta();
  denyAnalyticsConsent(); cta();
  grantAnalyticsConsent(); initializeAmplitude();
  await Promise.resolve(); await Promise.resolve();
  cta();
  trackAnalyticsEvent(AnalyticsEvents.sectionView, { page_type: "landing", section_id: "hero" });
  expect(sdk.track).toHaveBeenCalledTimes(2);
  initializeGoogleAnalytics("G-LOCALTEST", false);
  initializeGoogleAnalytics("G-LOCALTEST", false);
  const events = () => (window.dataLayer ?? []).map(c => Array.from(c as ArrayLike<unknown>)).filter(([type]) => type === "event");
  expect(events()).toHaveLength(2); expect(sdk.track).toHaveBeenCalledTimes(2);
  expect(events()[0]).toEqual(["event", "cta_click", { page_type: "landing", cta_id: "login", cta_position: "header", page_path: "/", page_location: window.location.origin + "/" }]);
  denyAnalyticsConsent(); cta(); grantAnalyticsConsent(); initializeAmplitude(); cta();
  // This consented CTA is queued for GA, then discarded by another revoke.
  expect(sdk.track).toHaveBeenCalledTimes(3);
  denyAnalyticsConsent(); grantAnalyticsConsent(); initializeAmplitude(); initializeGoogleAnalytics("G-LOCALTEST", false);
  expect(events()).toHaveLength(2); expect(sdk.track).toHaveBeenCalledTimes(3);
});
