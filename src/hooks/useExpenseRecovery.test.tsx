// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { useExpenseRecovery } from "./useExpenseRecovery";
const mocks = vi.hoisted(() => ({
  connected: true,
  read: vi.fn<(_key: string) => Promise<unknown>>(async () => []),
  subscribe: vi.fn((_topic: string, _handler: (frame: { body: string }) => void) => ({ unsubscribe: vi.fn() })),
}));
const stompClient = { subscribe: mocks.subscribe };
vi.mock("@/contexts/StompContext", () => ({
  useStompContext: () => ({ client: stompClient, connected: mocks.connected }),
}));
vi.mock("@/lib/api/rooms/members", () => ({
  getRoomMembers: () => mocks.read("members"),
}));
vi.mock("@/lib/api/rooms/expenses", () => ({
  getExpenses: () => mocks.read("list"),
  getExpenseSummary: () => mocks.read("summary"),
  getExpenseBudget: () => mocks.read("budget"),
  getExpenseKrwSummary: () => mocks.read("krw"),
  getExpenseCurrencies: () => mocks.read("currencies"),
}));
function Probe() {
  const { syncStatus } = useExpenseRecovery("r", true);
  return <p>{syncStatus}</p>;
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("revalidates all required reads on visible focus and every visible 30 seconds, cleans listeners on exit", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  const visibility = vi
    .spyOn(document, "visibilityState", "get")
    .mockReturnValue("visible");
  const client = new QueryClient();
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <Probe />
        </QueryClientProvider>,
      );
    });
    expect(mocks.read.mock.calls.map((c) => c[0]).sort()).toEqual([
      "budget",
      "currencies",
      "krw",
      "list",
      "members",
      "summary",
    ]);
    mocks.read.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(mocks.read.mock.calls.map((c) => c[0]).sort()).toEqual([
      "budget",
      "currencies",
      "krw",
      "list",
      "members",
      "summary",
    ]);
    mocks.read.mockClear();
    visibility.mockReturnValue("hidden");
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(mocks.read).not.toHaveBeenCalled();
    visibility.mockReturnValue("visible");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(mocks.read).toHaveBeenCalledTimes(6);
    mocks.read.mockClear();
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(mocks.read).toHaveBeenCalledTimes(6);
  } finally {
    await act(async () => root.unmount());
    client.clear();
  }
  mocks.read.mockClear();
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(30_000);
  });
  expect(mocks.read).not.toHaveBeenCalled();
});

it("entry with warm inactive cache and reconnect each fetch all six endpoints", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.read.mockClear();
  mocks.connected = true;
  const client = new QueryClient();
  const host = document.createElement("div");
  const root = createRoot(host);
  const render = () =>
    root.render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
  for (const key of ["list", "summary", "summary-krw", "budget", "currencies", "members"])
    client.setQueryData(["room-expenses", "r", key], ["old"]);
  try {
    await act(async () => {
      render();
    });
    expect(mocks.read).toHaveBeenCalledTimes(6);
    mocks.connected = false;
    await act(async () => {
      render();
    });
    expect(host.textContent).toBe("disconnected");
    mocks.read.mockClear();
    mocks.connected = true;
    await act(async () => {
      render();
    });
    expect(mocks.read.mock.calls.map((c) => c[0]).sort()).toEqual([
      "budget",
      "currencies",
      "krw",
      "list",
      "members",
      "summary",
    ]);
    expect(host.textContent).toBe("ready");
  } finally {
    await act(async () => root.unmount());
    client.clear();
  }
});

it("revoked remount/reconnect stays terminal; mounted old consumer cannot adopt new admission", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const { beginExpenseRoomAdmission, getExpenseRecovery } = await import("@/lib/expenses/expense-recovery");
  mocks.read.mockClear();
  const client = new QueryClient();
  const old = getExpenseRecovery(client, "r");
  old.revoke();
  const host = document.createElement("div");
  const root = createRoot(host);
  const render = (key = "old") => root.render(<QueryClientProvider client={client}><Probe key={key} /></QueryClientProvider>);
  try {
    await act(async () => { render(); });
    mocks.connected = false;
    await act(async () => { render(); });
    mocks.connected = true;
    await act(async () => { render("remount"); });
    expect(host.textContent).toBe("revoked");
    expect(mocks.read).not.toHaveBeenCalled();
    await act(async () => {
      beginExpenseRoomAdmission(client)("r", true);
      render("remount");
    });
    expect(host.textContent).toBe("revoked");
    expect(mocks.read).not.toHaveBeenCalled();
    await act(async () => { render("authorized-entry"); });
    expect(host.textContent).toBe("ready");
    expect(mocks.read).toHaveBeenCalledTimes(6);
    expect(old.getSnapshot()).toBe("revoked");
  } finally { await act(async () => root.unmount()); client.clear(); }
});


it.each([
  ["EXPENSES_INVALIDATED", "BUDGET_INVALIDATED"],
  ["BUDGET_INVALIDATED", "EXPENSES_INVALIDATED"],
])("handles duplicate %s then %s subscription frames during response races", async (first, second) => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.connected = true;
  mocks.read.mockResolvedValue([]);
  mocks.subscribe.mockClear();
  const client = new QueryClient();
  const root = createRoot(document.createElement("div"));
  const { getExpenseRecovery } = await import("@/lib/expenses/expense-recovery");
  const recovery = getExpenseRecovery(client, "r");
  const deferred = new Map<string, (value: unknown) => void>();
  try {
    await act(async () => {
      root.render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>);
    });
    const subscription = mocks.subscribe.mock.calls.find(([topic]) => topic === "/topic/rooms/r/expenses");
    expect(subscription).toBeDefined();
    const deliver = (type: string) => subscription![1]({
      body: JSON.stringify({ roomId: "r", type, sessionId: "same-account-session" }),
    });
    const stale = (key: string) => key === "budget" ? { budgetKrw: "260000", version: 1 } : [{ revision: 1 }];
    const latest = (key: string) => key === "budget" ? { budgetKrw: "270000", version: 2 } : [{ revision: 2 }];
    // Hold all initial reads so frames arrive while older responses are in flight.
    mocks.read.mockImplementation((key) => new Promise((resolve) => deferred.set(key, resolve)));
    let reading!: Promise<void>;
    await act(async () => { reading = recovery.refresh("all"); });
    expect(deferred.has("budget")).toBe(true);
    expect(deferred.has("list")).toBe(true);
    await act(async () => {
      deliver(first);
      deliver(first);
      deliver(second);
      deliver(second);
    });
    mocks.read.mockImplementation(async (key) => latest(key));
    // Resolve the opposite resource first; the late old list/budget must be followed by new GETs.
    const earlyKey = first === "EXPENSES_INVALIDATED" ? "budget" : "list";
    await act(async () => { deferred.get(earlyKey)!(stale(earlyKey)); });
    expect(recovery.getSnapshot()).toBe("pending");
    await act(async () => {
      for (const [key, resolve] of [...deferred].reverse())
        if (key !== earlyKey) resolve(stale(key));
      await reading;
    });
    expect(client.getQueryData(["room-expenses", "r", "budget"])).toEqual({ budgetKrw: "270000", version: 2 });
    for (const key of ["list", "summary", "summary-krw"])
      expect(client.getQueryData(["room-expenses", "r", key])).toEqual([{ revision: 2 }]);
    expect(recovery.getSnapshot()).toBe("ready");
  } finally {
    mocks.read.mockResolvedValue([]);
    await act(async () => root.unmount());
    client.clear();
  }
});
