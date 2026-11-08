// @vitest-environment jsdom
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { finishGoogleLogin } from "./google-login-client";
import { setPendingInviteCode, consumePendingInviteCode } from "./session-user-flow";
import { saveGoogleAgreementFlowSession } from "./google-oauth";
import { analyticsConsentStore } from "./analytics/consent-store";
import { initializeGoogleAnalytics, revokeGoogleAnalyticsConsent } from "./analytics/client";
import { tearDownClientSession } from "./client-storage";

vi.mock("./analytics/runtime", () => ({ analyticsRuntime: { enabled: true } }));
vi.mock("./analytics/amplitude-runtime", () => ({ amplitudeRuntime: { enabled: false } }));
const session = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("./session-user", () => ({ fetchSessionUserWithRetry: session.read }));
let client: QueryClient;
function commands() {
  return (window.dataLayer ?? []).map(c => Array.from(c as ArrayLike<unknown>));
}
beforeEach(() => {
  client = new QueryClient();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/auth/callback?code=test-code&state=test-state");
  window.dataLayer = [];
  session.read.mockResolvedValue({ id: 42, email: "fixture@example.test", nickname: "fixture", profileImageUrl: null, provider: "GOOGLE", tutorialCompleted: false });
  analyticsConsentStore.set("granted");
  initializeGoogleAnalytics("G-TEST", false);
  window.dataLayer = [];
});
afterEach(() => { client.clear(); vi.clearAllMocks(); });
it.each(["login", "signup", "reaccept"] as const)("returns the same invite campaign after %s and sets identity before its event", async kind => {
  setPendingInviteCode("test-invite", "?utm_campaign=existing&code=secret");
  if (kind === "signup") saveGoogleAgreementFlowSession({ kind, signupToken: "test-signup", expiresAt: Date.now() + 10000 });
  if (kind === "reaccept") saveGoogleAgreementFlowSession({ kind, reacceptanceToken: "test-reaccept", expiresAt: Date.now() + 10000 });
  expect(await finishGoogleLogin(client)).toBe("/join/test-invite?utm_campaign=existing");
  expect(consumePendingInviteCode()).toBeNull();
  expect(commands()).toEqual([
    ["set", { user_id: "42" }],
    ["event", kind === "signup" ? "sign_up" : "login", {
      method: "google", entry_point: "invite", page_path: "/auth/callback", page_location: "http://localhost:3000/auth/callback",
    }],
  ]);
  tearDownClientSession({ queryClient: client });
  expect(commands().at(-1)).toEqual(["set", { user_id: null }]);
});
it("does not replay a denied-consent login after later consent", async () => {
  revokeGoogleAnalyticsConsent();
  analyticsConsentStore.set("denied");
  window.dataLayer = [];
  setPendingInviteCode("test-invite", "?utm_source=partner");
  expect(await finishGoogleLogin(client)).toBe("/join/test-invite?utm_source=partner");
  expect(commands()).toEqual([]);
  analyticsConsentStore.set("granted");
  initializeGoogleAnalytics("G-TEST", false);
  expect(commands().some(([name]) => name === "event")).toBe(false);
});
it("keeps the pending invitation when session confirmation fails", async () => {
  session.read.mockResolvedValue(null);
  setPendingInviteCode("test-invite", "?utm_source=partner");
  expect(await finishGoogleLogin(client)).toBeNull();
  expect(consumePendingInviteCode()).toBe("test-invite");
  expect(commands().some(([name]) => name === "event")).toBe(false);
});
it("does not invent an invite campaign for ordinary login", async () => {
  expect(await finishGoogleLogin(client)).toBe("/home");
  expect(commands()[1]).toEqual(["event", "login", {
    method: "google", entry_point: "direct", page_path: "/auth/callback", page_location: "http://localhost:3000/auth/callback",
  }]);
});
