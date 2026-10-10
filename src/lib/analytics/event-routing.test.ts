import { afterEach, beforeEach, expect, it, vi } from "vitest";

const sinks = vi.hoisted(() => ({ amplitude: vi.fn(), ga: vi.fn(), gaEnabled: true }));
vi.mock("./amplitude", () => ({
  sendAmplitudeDataCommand: sinks.amplitude,
  revokeAmplitudeConsent: vi.fn(),
}));
vi.mock("./runtime", () => ({ analyticsRuntime: { get enabled() { return sinks.gaEnabled; } } }));

beforeEach(() => {
  sinks.gaEnabled = true;
  vi.stubGlobal("window", { gtag: sinks.ga, location: { protocol: "https:", hostname: "example.test" } });
  vi.stubGlobal("document", { cookie: "uttae_analytics_consent=v1:granted" });
});
afterEach(() => { vi.resetModules(); vi.resetAllMocks(); vi.unstubAllGlobals(); });

it.each([
  ["sign_up", "both"], ["login", "both"], ["create_plan", "both"],
  ["invite_view", "both"], ["join_group", "both"], ["view_plan", "both"],
  ["share", "both"], ["add_to_bookmark", "both"], ["add_to_itinerary", "both"],
  ["expense_created", "both"], ["packing_item_added", "both"], ["page_view", "both"],
  ["view_search_results", "amplitude"], ["view_place", "amplitude"],
  ["create_bookmark_folder", "amplitude"], ["remove_from_itinerary", "amplitude"],
  ["reorder_itinerary", "amplitude"], ["chat_message_sent", "amplitude"],
  ["tutorial_begin", "amplitude"], ["tutorial_complete", "amplitude"], ["tutorial_skip", "amplitude"],
  ["expense_updated", "amplitude"], ["expense_deleted", "amplitude"],
  ["expense_budget_saved", "amplitude"], ["settlement_summary_viewed", "amplitude"],
  ["packing_item_checked", "amplitude"], ["packing_item_unchecked", "amplitude"],
  ["cta_click", "ga4"], ["section_view", "ga4"],
] as const)("routes %s to %s once across delayed/repeated GA initialization", async (name, destination) => {
  const client = await import("./client");
  client.sendAnalyticsDataCommand("event", name, { source: "test" });
  expect(sinks.amplitude).toHaveBeenCalledTimes(destination === "ga4" ? 0 : 1);
  client.initializeGoogleAnalytics("G-TEST", false);
  client.initializeGoogleAnalytics("G-TEST", false);
  expect(sinks.ga.mock.calls.filter(([type]) => type === "event")).toEqual(
    destination === "amplitude" ? [] : [["event", name, { source: "test" }]],
  );
  expect(sinks.amplitude).toHaveBeenCalledTimes(destination === "ga4" ? 0 : 1);
});

it("shares identity commands without treating them as product events", async () => {
  const client = await import("./client");
  client.initializeGoogleAnalytics("G-TEST", false);
  sinks.ga.mockClear(); sinks.amplitude.mockClear();
  client.sendAnalyticsDataCommand("set", { user_id: "42" });
  expect(sinks.ga).toHaveBeenCalledWith("set", { user_id: "42" });
  expect(sinks.amplitude).toHaveBeenCalledWith("set", { user_id: "42" });
});

it("does not silently send unknown or malformed events to either sink", async () => {
  const client = await import("./client");
  client.initializeGoogleAnalytics("G-TEST", false);
  sinks.ga.mockClear(); sinks.amplitude.mockClear();
  for (const name of ["new_unclassified_event", "toString", null]) client.sendAnalyticsDataCommand("event", name);
  expect(sinks.ga).not.toHaveBeenCalled();
  expect(sinks.amplitude).not.toHaveBeenCalled();
});

it("enforces pending/denied/revoked consent without backfilling events", async () => {
  vi.stubGlobal("document", { cookie: "" });
  const client = await import("./client");
  const { analyticsConsentStore: consent } = await import("./consent-store");
  const sendAll = () => ["create_plan", "expense_updated", "cta_click"].forEach(name => client.sendAnalyticsDataCommand("event", name));
  sendAll(); consent.set("denied"); sendAll();
  expect(sinks.amplitude).not.toHaveBeenCalled();
  consent.set("granted"); sendAll();
  expect(sinks.amplitude.mock.calls.filter(([type]) => type === "event")).toHaveLength(2);
  client.revokeGoogleAnalyticsConsent(); consent.set("denied"); sendAll();
  consent.set("granted"); client.initializeGoogleAnalytics("G-TEST", false);
  expect(sinks.ga.mock.calls.filter(([type]) => type === "event")).toEqual([]);
  expect(sinks.amplitude.mock.calls.filter(([type]) => type === "event")).toHaveLength(2);
});

it("keeps Amplitude delivery independent of GA being disabled", async () => {
  sinks.gaEnabled = false;
  const client = await import("./client");
  client.sendAnalyticsDataCommand("event", "expense_created");
  client.sendAnalyticsDataCommand("event", "expense_updated");
  client.sendAnalyticsDataCommand("event", "cta_click");
  expect(sinks.amplitude.mock.calls).toEqual([["event", "expense_created"], ["event", "expense_updated"]]);
  expect(sinks.ga).not.toHaveBeenCalled();
});

it("does not let a failed analytics sink interrupt the user action or the other sink", async () => {
  const client = await import("./client");
  client.initializeGoogleAnalytics("G-TEST", false);
  sinks.amplitude.mockImplementation(() => { throw new Error("SDK unavailable"); });
  expect(() => client.sendAnalyticsDataCommand("event", "expense_created")).not.toThrow();
  expect(sinks.ga).toHaveBeenCalledWith("event", "expense_created");
  sinks.ga.mockImplementation(() => { throw new Error("tag unavailable"); });
  expect(() => client.sendAnalyticsDataCommand("event", "expense_created")).not.toThrow();
});
