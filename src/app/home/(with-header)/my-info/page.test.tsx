import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { sessionUserQueryKey } from "@/lib/query-keys";
import MyInfoPage from "./page";
import { WithdrawAccountConfirmModal } from "@/components/settings/WithdrawAccountConfirmModal";

const mocks = vi.hoisted(() => ({
  withdraw: vi.fn(),
  clearPreferences: vi.fn(),
  tearDown: vi.fn(),
  replace: vi.fn(),
  resetIdentity: vi.fn(),
}));
vi.mock("next/link", () => ({ default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@tanstack/react-query", async original => ({
  ...await original<typeof import("@tanstack/react-query")>(),
  useQueryClient: () => queryClient,
}));
vi.mock("@/hooks/useSessionUser", () => ({ useSessionUser: () => ({
  data: { id: 7, nickname: "사용자", email: "example@example.test", provider: "GOOGLE" },
  isLoading: false, isFetching: false, refetch: vi.fn(),
}) }));
vi.mock("@/lib/api/user", () => ({ withdrawAccount: mocks.withdraw }));
vi.mock("@/lib/api/auth", () => ({ logout: vi.fn() }));
vi.mock("@/lib/analytics/amplitude", () => ({
  resetAmplitudeIdentityOnLogout: mocks.resetIdentity,
  sendAmplitudeDataCommand: vi.fn(),
  revokeAmplitudeConsent: vi.fn(),
}));
vi.mock("@/lib/client-storage", async original => {
  const actual = await original<typeof import("@/lib/client-storage")>();
  return { ...actual, tearDownClientSession: (...args: Parameters<typeof actual.tearDownClientSession>) => {
    mocks.tearDown(...args);
    actual.tearDownClientSession(...args);
  } };
});
vi.mock("@/lib/expenses/expense-currency-preference", () => ({
  clearExpenseCurrencyPreferencesForUser: mocks.clearPreferences,
}));
vi.mock("@/components/analytics/CookieSettingsProvider", () => ({ CookieSettingsButton: () => null }));
vi.mock("@/components/user/UserAvatar", () => ({ UserAvatar: () => null }));
vi.mock("@/components/settings/WithdrawAccountConfirmModal", () => ({ WithdrawAccountConfirmModal: () => null }));
vi.mock("@/components/settings/WithdrawalDelegationRequiredModal", () => ({ WithdrawalDelegationRequiredModal: () => null }));

let renderer: ReactTestRenderer;
const queryClient = new QueryClient();
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  queryClient.setQueryData(sessionUserQueryKey, { id: 7 });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  vi.unstubAllGlobals();
  queryClient.clear();
});

async function confirmWithdrawal() {
  await act(async () => {
    renderer = create(<MyInfoPage />);
  });
  const open = renderer.root.findAllByType("button").find(
    (button) => button.children.includes("회원 탈퇴"),
  )!;
  await act(async () => open.props.onClick());
  await act(async () => renderer.root.findByType(WithdrawAccountConfirmModal).props.onConfirm());
}

it("clears only the signed-in user's currency preferences after confirmed account deletion", async () => {
  mocks.withdraw.mockResolvedValueOnce({ ok: true });
  await confirmWithdrawal();
  expect(mocks.clearPreferences).toHaveBeenCalledExactlyOnceWith(7);
  expect(mocks.tearDown).toHaveBeenCalledOnce();
  expect(mocks.resetIdentity).toHaveBeenCalledOnce();
  expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
});

it("retains currency preferences when account deletion fails", async () => {
  mocks.withdraw.mockResolvedValueOnce({ ok: false, kind: "error", status: 500 });
  await confirmWithdrawal();
  expect(mocks.clearPreferences).not.toHaveBeenCalled();
  expect(mocks.tearDown).not.toHaveBeenCalled();
  expect(mocks.resetIdentity).not.toHaveBeenCalled();
});
