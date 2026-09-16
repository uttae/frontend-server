// @vitest-environment jsdom
import { evictRoomFromClientCaches } from "@/lib/stomp/forced-room-exit-dispatch";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { hookHarness } from "@/test/hook-harness";
import { useJoinRoom, useCheckJoinStatus } from "./useRooms";
import { getExpenseRecovery } from "@/lib/expenses/expense-recovery";
const api = vi.hoisted(() => ({ join: vi.fn(), status: vi.fn() }));
vi.mock("@/lib/api/rooms/join", async (original) => ({
  ...await original<object>(), joinRoom: api.join, getJoinStatus: api.status,
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/waiting" }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });
it.each(["join", "approval"])("%s requires fresh successful admission and fences stale responses", async (path) => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const client = new QueryClient();
  const old = getExpenseRecovery(client, "r");
  old.revoke();
  const hook = hookHarness(() => ({ join: useJoinRoom(), approval: useCheckJoinStatus() }), child =>
    <QueryClientProvider client={client}>{child}</QueryClientProvider>);
  const request = path === "join" ? api.join : api.status;
  const response = { id: "r", roomTitle: "Room", role: "MEMBER", status: "APPROVED", httpStatus: 200 };
  try {
    await hook.render(undefined);
    request.mockResolvedValueOnce({ ...response, status: "PENDING", httpStatus: 202 });
    await act(async () => { await hook.current[path as "join" | "approval"].mutateAsync("r"); });
    expect(getExpenseRecovery(client, "r")).toBe(old);
    let finish!: (value: typeof response) => void;
    request.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    let pending!: Promise<unknown>;
    await act(async () => { pending = hook.current[path as "join" | "approval"].mutateAsync("r"); });
    evictRoomFromClientCaches(client, "r");
    await act(async () => { finish(response); await pending; });
    expect(getExpenseRecovery(client, "r")).toBe(old);
    request.mockResolvedValueOnce(response);
    await act(async () => { await hook.current[path as "join" | "approval"].mutateAsync("r"); });
    expect(getExpenseRecovery(client, "r")).not.toBe(old);
    expect(old.getSnapshot()).toBe("revoked");
  } finally { await hook.unmount(); client.clear(); }
});
