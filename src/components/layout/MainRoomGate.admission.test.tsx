// @vitest-environment jsdom
import { evictRoomFromClientCaches } from "@/lib/stomp/forced-room-exit-dispatch";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { hookHarness } from "@/test/hook-harness";
import { MainRoomGate } from "./MainRoomGate";
import { getExpenseRecovery } from "@/lib/expenses/expense-recovery";
import { useSessionStore } from "@/stores/session-store";
const mocks = vi.hoisted(() => ({ validate: vi.fn(), replace: vi.fn() }));
const router = { replace: mocks.replace };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/hooks/use-room-id", () => ({ useCurrentRoomId: () => ({ roomId: "r", roomContextReady: true }) }));
vi.mock("@/hooks/useChatPanelOpen", () => ({ useChatPanelOpen: () => true }));
vi.mock("@/lib/rooms", () => ({ validateRoomAccess: mocks.validate }));
vi.mock("@/hooks/useSessionUser", () => ({ useSessionUser: () => ({ data: { id: 1 } }) }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });
it.each(["ok", "forbidden", "error", "stale"])("entry/auth admission %s only replaces after fresh room confirmation", async verdict => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  useSessionStore.setState({ sessionReady: false });
  const client = new QueryClient();
  const old = getExpenseRecovery(client, "r");
  old.revoke();
  let finish!: (value: string) => void;
  mocks.validate.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const hook = hookHarness(() => null, child => <QueryClientProvider client={client}><MainRoomGate>{child}</MainRoomGate></QueryClientProvider>);
  try {
    await hook.render(undefined);
    expect(getExpenseRecovery(client, "r")).toBe(old);
    await act(async () => { useSessionStore.setState({ sessionReady: true }); });
    expect(getExpenseRecovery(client, "r")).toBe(old);
    if (verdict === "stale") evictRoomFromClientCaches(client, "r");
    await act(async () => { finish(verdict === "stale" ? "ok" : verdict); });
    if (verdict === "ok") expect(getExpenseRecovery(client, "r")).not.toBe(old);
    else expect(getExpenseRecovery(client, "r")).toBe(old);
    expect(old.getSnapshot()).toBe("revoked");
  } finally { await hook.unmount(); client.clear(); }
});
