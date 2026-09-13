// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { useExpenseRecovery } from "./useExpenseRecovery";
const mocks = vi.hoisted(() => ({
  connected: true,
  read: vi.fn<(_key: string) => Promise<never[]>>(async () => []),
  subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
}));
const stompClient = { subscribe: mocks.subscribe };
vi.mock("@/contexts/StompContext", () => ({
  useStompContext: () => ({ client: stompClient, connected: mocks.connected }),
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
it("revalidates four reads on visible focus and every visible 30 seconds, cleans listeners on exit", async () => {
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
      "summary",
    ]);
    mocks.read.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(mocks.read.mock.calls.map((c) => c[0]).sort()).toEqual([
      "budget",
      "krw",
      "list",
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
    expect(mocks.read).toHaveBeenCalledTimes(4);
    mocks.read.mockClear();
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(mocks.read).toHaveBeenCalledTimes(4);
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

it("entry with warm inactive cache and reconnect each fetch all five endpoints", async () => {
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
  for (const key of ["list", "summary", "summary-krw", "budget", "currencies"])
    client.setQueryData(["room-expenses", "r", key], ["old"]);
  try {
    await act(async () => {
      render();
    });
    expect(mocks.read).toHaveBeenCalledTimes(5);
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
    expect(mocks.read).toHaveBeenCalledTimes(5);
    expect(old.getSnapshot()).toBe("revoked");
  } finally { await act(async () => root.unmount()); client.clear(); }
});
