// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({ initAll: vi.fn(async () => {}), track: vi.fn(), setUserId: vi.fn(), setOptOut: vi.fn() }));
vi.mock("@amplitude/unified", () => sdk);
vi.mock("./runtime", () => ({ analyticsRuntime: { enabled: true } }));
vi.mock("./amplitude-runtime", () => ({ amplitudeRuntime: { enabled: true, apiKey: "test", sessionReplaySampleRate: 0 } }));
afterEach(() => {
  document.cookie = "uttae_analytics_consent=; Max-Age=0; Path=/";
  delete window.gtag; delete window.dataLayer;
  vi.resetModules(); vi.clearAllMocks();
});

it("links shared and joined rooms in Amplitude without leaking IDs to GA or later events", async () => {
  const { grantAnalyticsConsent } = await import("./consent-actions");
  const { initializeGoogleAnalytics } = await import("./client");
  const { initializeAmplitude } = await import("./amplitude");
  const { AnalyticsEvents, trackAnalyticsEvent, setAnalyticsUserId } = await import("./track");
  grantAnalyticsConsent();
  setAnalyticsUserId(17);
  trackAnalyticsEvent(AnalyticsEvents.sharePlan, { room_id: "existing-room-42", method: "copy_link", role: "host" });
  setAnalyticsUserId(29);
  trackAnalyticsEvent(AnalyticsEvents.joinPlan, { room_id: "existing-room-42", role: "member" });
  trackAnalyticsEvent(AnalyticsEvents.sharePlan, { room_id: "another-room", method: "native_share", role: "member" });
  trackAnalyticsEvent(AnalyticsEvents.expenseCreated);
  expect(sdk.track).not.toHaveBeenCalled();
  initializeAmplitude();
  await vi.waitFor(() => expect(sdk.track).toHaveBeenCalledTimes(4));
  expect(sdk.track.mock.calls[0]).toEqual([{
    event_type: "share",
    event_properties: { room_id: "existing-room-42", method: "copy_link", role: "host", page_path: "/", page_location: window.location.origin + "/" },
    groups: { room_id: "existing-room-42" },
  }]);
  expect(sdk.track.mock.calls[1][0]).toMatchObject({ event_type: "join_group", groups: { room_id: "existing-room-42" } });
  expect(sdk.track.mock.calls[2][0]).toMatchObject({ event_type: "share", groups: { room_id: "another-room" } });
  expect(sdk.track.mock.calls[3]).toEqual(["expense_created", { page_path: "/", page_location: window.location.origin + "/" }]);
  expect(sdk.setUserId.mock.calls).toEqual([["17"], ["29"]]);
  initializeGoogleAnalytics("G-TEST", false);
  initializeGoogleAnalytics("G-TEST", false);
  const events = (window.dataLayer ?? []).map(c => Array.from(c as ArrayLike<unknown>)).filter(([type]) => type === "event");
  expect(events.map(([, name]) => name)).toEqual(["share", "join_group", "share", "expense_created"]);
  expect(events[0][2]).toEqual({ method: "copy_link", role: "host", page_path: "/", page_location: window.location.origin + "/" });
  expect(JSON.stringify(events)).not.toMatch(/room_id|existing-room-42|another-room|groups/);
  trackAnalyticsEvent(AnalyticsEvents.joinPlan, { room_id: "immediate-room", role: "member" });
  const latest = Array.from(window.dataLayer!.at(-1) as ArrayLike<unknown>);
  expect(latest).toEqual(["event", "join_group", { role: "member", page_path: "/", page_location: window.location.origin + "/" }]);
  expect(sdk.track).toHaveBeenLastCalledWith(expect.objectContaining({ groups: { room_id: "immediate-room" } }));
});

it("drops pending room events on consent revocation", async () => {
  const { grantAnalyticsConsent, denyAnalyticsConsent } = await import("./consent-actions");
  const { initializeGoogleAnalytics } = await import("./client");
  const { initializeAmplitude } = await import("./amplitude");
  const { AnalyticsEvents, trackAnalyticsEvent } = await import("./track");
  grantAnalyticsConsent();
  trackAnalyticsEvent(AnalyticsEvents.sharePlan, { room_id: "room-42", method: "copy_link" });
  denyAnalyticsConsent();
  trackAnalyticsEvent(AnalyticsEvents.joinPlan, { room_id: "room-42" });
  grantAnalyticsConsent(); initializeAmplitude(); initializeGoogleAnalytics("G-TEST", false);
  await Promise.resolve(); await Promise.resolve();
  expect(sdk.track).not.toHaveBeenCalled();
  expect((window.dataLayer ?? []).map(c => Array.from(c as ArrayLike<unknown>)).filter(([type]) => type === "event")).toEqual([]);
});

it("does not create a group for an empty room ID or change the anonymous user ID", async () => {
  const { grantAnalyticsConsent } = await import("./consent-actions");
  const { initializeAmplitude } = await import("./amplitude");
  const { AnalyticsEvents, trackAnalyticsEvent } = await import("./track");
  grantAnalyticsConsent(); initializeAmplitude();
  await Promise.resolve(); await Promise.resolve();
  trackAnalyticsEvent(AnalyticsEvents.sharePlan, { room_id: "", method: "copy_link" });
  expect(sdk.track).toHaveBeenCalledWith("share", { method: "copy_link", page_path: "/", page_location: window.location.origin + "/" });
  expect(sdk.setUserId).not.toHaveBeenCalled();
});
