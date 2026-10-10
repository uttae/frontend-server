// @vitest-environment jsdom
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { sdk } from "./test-support/delivery-fixture";

let client: QueryClient;
let userId: string | undefined;
let deviceId: string;
let resetCount: number;
const delivered: { name: string; userId: string | undefined; deviceId: string }[] = [];
beforeEach(() => {
  client = new QueryClient();
  userId = undefined; deviceId = "previous-device"; resetCount = 0; delivered.length = 0;
  sdk.initAll.mockResolvedValue(undefined);
  sdk.setUserId.mockImplementation(value => { userId = value; });
  sdk.reset.mockImplementation(() => { userId = undefined; deviceId = `fresh-${++resetCount}`; });
  sdk.track.mockImplementation(event => { delivered.push({ name: typeof event === "string" ? event : event.event_type, userId, deviceId }); });
});
afterEach(() => { client.clear(); document.cookie = "AMP_local-test=; Max-Age=0; Path=/"; });

async function setup({ consent = true, initialize = true } = {}) {
  const { analyticsConsentStore } = await import("./consent-store");
  const { initializeAmplitude } = await import("./amplitude");
  const { initializeGoogleAnalytics } = await import("./client");
  const { setAnalyticsUserId, trackAnalyticsEvent, AnalyticsEvents } = await import("./track");
  const { tearDownClientSession } = await import("@/lib/client-storage");
  const { sessionUserQueryKey } = await import("@/lib/query-keys");
  const login = (id: number) => {
    client.setQueryData(sessionUserQueryKey, { id });
    setAnalyticsUserId(id);
  };
  if (consent) analyticsConsentStore.set("granted");
  if (initialize) {
    initializeAmplitude(); initializeGoogleAnalytics("G-TEST", false);
    await vi.waitFor(() => expect(sdk.setOptOut).toHaveBeenCalledWith(false));
  }
  const event = () => trackAnalyticsEvent(AnalyticsEvents.inviteView, { entry_point: "invite" });
  return { consent: analyticsConsentStore, initializeAmplitude, setAnalyticsUserId, login, event, logout: () => tearDownClientSession({ queryClient: client }) };
}

it("isolates post-logout anonymous events and preserves GA's user-id clearing", async () => {
  const app = await setup();
  app.login(42); app.event();
  app.logout(); app.event();
  expect(delivered).toEqual([
    { name: "invite_view", userId: "42", deviceId: "previous-device" },
    { name: "invite_view", userId: undefined, deviceId: "fresh-1" },
  ]);
  const commands = (window.dataLayer ?? []).map(c => Array.from(c as ArrayLike<unknown>));
  expect(commands).toContainEqual(["set", { user_id: null }]);
  expect(commands.some(([command]) => command === "reset")).toBe(false);
});

it("does not reset identity for normal anonymous page setup or repeated teardown", async () => {
  const app = await setup();
  app.setAnalyticsUserId(null); app.logout();
  expect(sdk.reset).not.toHaveBeenCalled();
  app.login(42); app.logout(); app.logout(); app.setAnalyticsUserId(null);
  expect(sdk.reset).toHaveBeenCalledTimes(1);
  app.login(84); app.event();
  expect(delivered.at(-1)).toEqual({ name: "invite_view", userId: "84", deviceId: "fresh-1" });
});

it("discards the old user's queued commands and resets before a new login after initialization", async () => {
  let complete!: () => void;
  sdk.initAll.mockReturnValueOnce(new Promise<void>(resolve => { complete = resolve; }));
  const app = await setup({ initialize: false });
  app.login(42); app.event(); app.initializeAmplitude();
  app.logout(); app.login(84); app.event();
  expect(sdk.reset).not.toHaveBeenCalled();
  complete();
  await vi.waitFor(() => expect(delivered).toHaveLength(1));
  expect(delivered).toEqual([{ name: "invite_view", userId: "84", deviceId: "fresh-1" }]);
});

it("does not initialize or grant consent on logout, and resets before subsequent consented events", async () => {
  const app = await setup({ consent: false, initialize: false });
  document.cookie = "AMP_local-test=old-identity; Path=/";
  document.cookie = "unrelated=value; Path=/";
  app.login(42); app.logout();
  expect(sdk.initAll).not.toHaveBeenCalled();
  expect(app.consent.getSnapshot()).toBe("pending");
  expect(document.cookie).not.toContain("AMP_local-test=");
  expect(document.cookie).toContain("unrelated=value");
  app.consent.set("granted"); app.initializeAmplitude(); app.event();
  await vi.waitFor(() => expect(delivered).toHaveLength(1));
  expect(delivered[0].deviceId).toBe("fresh-1");
  document.cookie = "unrelated=; Max-Age=0; Path=/";
});

it("resets while opted out without re-enabling analytics", async () => {
  const app = await setup();
  app.login(42);
  const { denyAnalyticsConsent } = await import("./consent-actions");
  denyAnalyticsConsent(); sdk.setOptOut.mockClear();
  app.logout(); app.event();
  expect(sdk.reset).toHaveBeenCalledTimes(1);
  expect(sdk.setOptOut).not.toHaveBeenCalledWith(false);
  expect(app.consent.getSnapshot()).toBe("denied");
  expect(delivered).toEqual([]);
});

it("keeps the identity boundary through initialization failure and retry", async () => {
  const app = await setup({ initialize: false });
  let reject!: (error: Error) => void;
  sdk.initAll.mockReturnValueOnce(new Promise<void>((_, fail) => { reject = fail; }));
  app.login(42); app.initializeAmplitude(); app.logout();
  reject(new Error("init failed"));
  await new Promise(resolve => setTimeout(resolve, 0));
  app.login(84); app.event(); app.initializeAmplitude();
  await vi.waitFor(() => expect(delivered).toHaveLength(1));
  expect(delivered).toEqual([{ name: "invite_view", userId: "84", deviceId: "fresh-1" }]);
});

it("does not re-enable tracking when consent is revoked while reset waits for initialization", async () => {
  let complete!: () => void;
  sdk.initAll.mockReturnValueOnce(new Promise<void>(resolve => { complete = resolve; }));
  const app = await setup({ initialize: false });
  app.login(42); app.initializeAmplitude(); app.logout();
  const { denyAnalyticsConsent } = await import("./consent-actions");
  denyAnalyticsConsent();
  complete();
  await vi.waitFor(() => expect(sdk.reset).toHaveBeenCalledTimes(1));
  expect(sdk.setOptOut).not.toHaveBeenCalledWith(false);
  expect(delivered).toEqual([]);
  app.consent.set("granted"); app.initializeAmplitude(); app.event();
  expect(delivered).toEqual([{ name: "invite_view", userId: undefined, deviceId: "fresh-1" }]);
});

it("still clears the app session if the browser refuses identity-cookie deletion", async () => {
  const app = await setup({ initialize: false });
  app.login(42);
  const cookieSetter = vi.spyOn(document, "cookie", "set").mockImplementation(() => { throw new Error("storage blocked"); });
  try {
    expect(() => app.logout()).not.toThrow();
    const { sessionUserQueryKey } = await import("@/lib/query-keys");
    expect(client.getQueryData(sessionUserQueryKey)).toBeNull();
  } finally {
    cookieSetter.mockRestore();
  }
  app.initializeAmplitude(); app.event();
  await vi.waitFor(() => expect(delivered).toHaveLength(1));
  expect(delivered[0].deviceId).toBe("fresh-1");
});
