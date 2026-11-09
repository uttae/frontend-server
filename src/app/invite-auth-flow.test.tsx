// @vitest-environment jsdom
import { useEffect, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import JoinPage from "./join/[inviteCode]/page";
import AuthCallbackPage from "./auth/callback/page";
import LoginAgreementsPage from "./login/agreements/page";
import { saveOAuthPendingSession, readGoogleAgreementFlowSession, buildGoogleAuthorizationUrl } from "@/lib/google-oauth";
import { pendingInviteAuthPath, setPendingInviteCode, consumePendingInviteCode } from "@/lib/session-user-flow";

const ports = vi.hoisted(() => ({
  router: { replace: vi.fn() },
  code: "test-invite",
  exchange: vi.fn(), signup: vi.fn(), reaccept: vi.fn(), join: vi.fn(),
  readUser: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ports.router,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useParams: () => ({ inviteCode: ports.code }),
}));
vi.mock("@/lib/api/auth", () => ({
  exchangeGoogleCode: ports.exchange,
  completeGoogleSignup: ports.signup,
  completeGoogleReaccept: ports.reaccept,
}));
vi.mock("@/lib/session-user", () => ({ fetchSessionUserWithRetry: ports.readUser }));
vi.mock("@/hooks/useRooms", () => ({ useJoinRoom: () => ({ mutate: ports.join }) }));
vi.mock("@/components/BrandLogo", () => ({ BrandLogo: () => null }));
vi.mock("@/components/agreements/AgreementConsentSection", () => ({
  AgreementConsentSection: ({ onStateChange }: { onStateChange: (state: { isLoading: boolean; isError: boolean; canProceed: boolean }) => void }) => {
    useEffect(() => onStateChange({ isLoading: false, isError: false, canProceed: true }), [onStateChange]);
    return null;
  },
}));
let client: QueryClient;
let renderer: ReactTestRenderer | undefined;
async function mount(node: ReactNode, path: string) {
  if (renderer) await act(async () => renderer?.unmount());
  window.history.replaceState(null, "", path);
  await act(async () => { renderer = create(<QueryClientProvider client={client}>{node}</QueryClientProvider>); });
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
  client = new QueryClient();
  sessionStorage.clear();
  ports.code = "test-invite";
  ports.readUser.mockResolvedValue({ id: 42, email: "fixture@example.test", nickname: "fixture", profileImageUrl: null, provider: "GOOGLE", tutorialCompleted: false });
  ports.signup.mockResolvedValue({ ok: true });
  ports.reaccept.mockResolvedValue({ ok: true });
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
  client.clear();
  vi.unstubAllGlobals(); vi.clearAllMocks();
});
const campaign = "utm_source=member_invite&utm_medium=referral&utm_campaign=invite";
it("carries only incoming campaign parameters from the invite page to login", async () => {
  await mount(<JoinPage />, `/join/test-invite?${campaign}&code=secret&state=secret`);
  expect(ports.router.replace).toHaveBeenCalledWith(`/login?${campaign}`);
  expect(pendingInviteAuthPath("/login/agreements")).toBe(`/login/agreements?${campaign}`);
});
it.each(["signup", "reaccept"] as const)("carries the original partial campaign through callback, %s and invite return", async kind => {
  setPendingInviteCode("test-invite", "?utm_campaign=existing");
  saveOAuthPendingSession({ state: "expected-state" });
  ports.exchange.mockResolvedValue(kind === "signup"
    ? { ok: true, status: "SIGNUP_REQUIRED", signupToken: "test-signup", expiresInSeconds: 600 }
    : { ok: true, status: "REACCEPTANCE_REQUIRED", reacceptanceToken: "test-reaccept", expiresInSeconds: 600 });
  await mount(<AuthCallbackPage />, "/auth/callback?code=test-code&state=expected-state");
  expect(ports.exchange).toHaveBeenCalledExactlyOnceWith("test-code", undefined);
  expect(ports.router.replace).toHaveBeenLastCalledWith("/login/agreements?utm_campaign=existing");
  expect(readGoogleAgreementFlowSession()?.kind).toBe(kind);
  await mount(<LoginAgreementsPage />, "/login/agreements?utm_campaign=existing");
  const button = renderer!.root.findAllByType("button").find(b => b.children.includes(kind === "signup" ? "동의하고 가입하기" : "동의하고 계속하기"))!;
  expect(button.props.disabled).toBe(false);
  await act(async () => { button.props.onClick(); });
  expect(ports.router.replace).toHaveBeenLastCalledWith("/join/test-invite?utm_campaign=existing");
  expect(kind === "signup" ? ports.signup : ports.reaccept).toHaveBeenCalledExactlyOnceWith(kind === "signup" ? "test-signup" : "test-reaccept");
  expect(consumePendingInviteCode()).toBeNull();
  expect(pendingInviteAuthPath("/login")).toBe("/login");
});
it("keeps state validation before any code exchange and preserves retry context", async () => {
  setPendingInviteCode("test-invite", `?${campaign}`);
  saveOAuthPendingSession({ state: "expected-state" });
  await mount(<AuthCallbackPage />, "/auth/callback?code=test-code&state=wrong-state");
  expect(ports.exchange).not.toHaveBeenCalled();
  expect(ports.router.replace).toHaveBeenCalledWith(`/login?error=OAuthCallback&${campaign}`);
  expect(sessionStorage.getItem("oauth_pending")).toBeNull();
  expect(buildGoogleAuthorizationUrl()).not.toContain("utm_");
});
it("preserves retry context after exchange rejection", async () => {
  setPendingInviteCode("test-invite", "?utm_source=partner");
  saveOAuthPendingSession({ state: "expected-state" });
  ports.exchange.mockRejectedValue(new Error("test network failure"));
  await mount(<AuthCallbackPage />, "/auth/callback?code=test-code&state=expected-state");
  expect(ports.router.replace).toHaveBeenLastCalledWith("/login?error=OAuthCallback&utm_source=partner");
});
it("removes stale pending context when an authenticated user opens another invitation", async () => {
  setPendingInviteCode("previous-invite", `?${campaign}`);
  vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));
  await mount(<JoinPage />, "/join/test-invite");
  expect(ports.join).toHaveBeenCalledWith("test-invite", expect.any(Object));
  expect(consumePendingInviteCode()).toBeNull();
  expect(pendingInviteAuthPath("/login")).toBe("/login");
});
it("keeps ordinary unauthenticated invitation navigation untagged", async () => {
  await mount(<JoinPage />, "/join/test-invite");
  expect(ports.router.replace).toHaveBeenCalledWith("/login");
});
