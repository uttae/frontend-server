// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { sdk } from "./test-support/delivery-fixture";

it("keeps landing events GA-only across real SDK initialization and consent changes", async () => {
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
  expect(sdk.track).not.toHaveBeenCalled();
  initializeGoogleAnalytics("G-LOCALTEST", false);
  initializeGoogleAnalytics("G-LOCALTEST", false);
  const events = () => (window.dataLayer ?? []).map(c => Array.from(c as ArrayLike<unknown>)).filter(([type]) => type === "event");
  expect(events()).toHaveLength(2); expect(sdk.track).not.toHaveBeenCalled();
  expect(events()[0]).toEqual(["event", "cta_click", { page_type: "landing", cta_id: "login", cta_position: "header", page_path: "/", page_location: window.location.origin + "/" }]);
  denyAnalyticsConsent(); cta(); grantAnalyticsConsent(); initializeAmplitude(); cta();
  // This consented CTA is queued for GA, then discarded by another revoke.
  expect(sdk.track).not.toHaveBeenCalled();
  denyAnalyticsConsent(); grantAnalyticsConsent(); initializeAmplitude(); initializeGoogleAnalytics("G-LOCALTEST", false);
  expect(events()).toHaveLength(2); expect(sdk.track).not.toHaveBeenCalled();
});

it("routes mixed events through the real independent SDK queues without duplicate delivery", async () => {
  const { grantAnalyticsConsent, denyAnalyticsConsent } = await import("./consent-actions");
  const { trackAnalyticsEvent, AnalyticsEvents } = await import("./track");
  const { initializeGoogleAnalytics } = await import("./client");
  const { initializeAmplitude } = await import("./amplitude");
  grantAnalyticsConsent();
  trackAnalyticsEvent(AnalyticsEvents.expenseCreated, { room_id: "test-room" });
  trackAnalyticsEvent(AnalyticsEvents.packingItemChecked, { room_id: "test-room" });
  trackAnalyticsEvent(AnalyticsEvents.ctaClick, { page_type: "landing", cta_id: "start_trip", cta_position: "hero" });
  expect(sdk.track).not.toHaveBeenCalled();
  initializeAmplitude();
  await vi.waitFor(() => expect(sdk.track).toHaveBeenCalledTimes(2));
  initializeGoogleAnalytics("G-LOCALTEST", false);
  initializeGoogleAnalytics("G-LOCALTEST", false);
  const names = (window.dataLayer ?? []).map(c => Array.from(c as ArrayLike<unknown>)).filter(([type]) => type === "event").map(([, name]) => name);
  expect(names).toEqual(["expense_created", "cta_click"]);
  expect(sdk.track.mock.calls.map(([event]) => typeof event === "string" ? event : event.event_type)).toEqual(["expense_created", "packing_item_checked"]);
  denyAnalyticsConsent();
  trackAnalyticsEvent(AnalyticsEvents.expenseCreated, { room_id: "test-room" });
  grantAnalyticsConsent(); initializeAmplitude();
  expect(sdk.track).toHaveBeenCalledTimes(2);
});
