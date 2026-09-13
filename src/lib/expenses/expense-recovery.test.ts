import { evictRoomFromClientCaches } from "@/lib/stomp/forced-room-exit-dispatch";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { beginExpenseRoomAdmission, getExpenseRecovery } from "./expense-recovery";
import { expenseKeys } from "./expense-queries";
const api = vi.hoisted(() => ({
  read: vi.fn<(_key: string) => Promise<never[]>>(async () => []),
}));
vi.mock("@/lib/api/rooms/members", () => ({
  getRoomMembers: () => api.read("members"),
}));
vi.mock("@/lib/api/rooms/expenses", () => ({
  getExpenses: () => api.read("list"),
  getExpenseSummary: () => api.read("summary"),
  getExpenseKrwSummary: () => api.read("summary-krw"),
  getExpenseBudget: () => api.read("budget"),
  getExpenseCurrencies: () => api.read("currencies"),
}));
afterEach(() => {
  vi.clearAllMocks();
});
it("refreshes six endpoints without active observers and routes minimal own-session events", async () => {
  const client = new QueryClient();
  const recovery = getExpenseRecovery(client, "r");
  await recovery.refresh("all");
  expect(api.read.mock.calls.map((c) => c[0]).sort()).toEqual([
    "budget",
    "currencies",
    "list",
    "members",
    "summary",
    "summary-krw",
  ]);
  api.read.mockClear();
  await recovery.message(
    JSON.stringify({ roomId: "other", type: "EXPENSES_INVALIDATED" }),
  );
  expect(api.read).not.toHaveBeenCalled();
  await recovery.message(
    JSON.stringify({ roomId: "r", type: "EXPENSES_INVALIDATED" }),
  );
  expect(api.read.mock.calls.map((c) => c[0]).sort()).toEqual([
    "list",
    "summary",
    "summary-krw",
  ]);
  api.read.mockClear();
  await recovery.message(
    JSON.stringify({ roomId: "r", type: "BUDGET_INVALIDATED" }),
  );
  expect(api.read.mock.calls.map((c) => c[0])).toEqual(["budget"]);
  client.clear();
});
it("coalesces a burst but reruns events received during reads", async () => {
  const client = new QueryClient();
  let finish!: (v: never[]) => void;
  api.read.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const recovery = getExpenseRecovery(client, "r");
  const first = recovery.refresh("budget");
  await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
  const second = recovery.refresh("budget");
  const third = recovery.refresh("budget");
  finish([]);
  await Promise.all([first, second, third]);
  expect(api.read).toHaveBeenCalledTimes(2);
  expect(recovery.getSnapshot()).toBe("ready");
  client.clear();
});
it("rejects failed reads and does not report ready", async () => {
  const client = new QueryClient();
  api.read.mockRejectedValueOnce(new Error("offline"));
  const recovery = getExpenseRecovery(client, "r");
  await expect(recovery.refresh("budget")).rejects.toThrow("offline");
  expect(recovery.getSnapshot()).toBe("error");
  client.clear();
});
it.each([
  { status: 403, code: "NOT_ROOM_MEMBER" },
  { status: 404, code: "ROOM_NOT_FOUND" },
])(
  "revokes room access and prevents late cache repopulation: %s",
  async (error) => {
    const client = new QueryClient();
    const recovery = getExpenseRecovery(client, "r");
    client.setQueryData(expenseKeys.list("r"), ["private"]);
    api.read.mockRejectedValueOnce(error);
    await expect(recovery.refresh("budget")).rejects.toEqual(error);
    expect(recovery.getSnapshot()).toBe("revoked");
    expect(client.getQueryData(expenseKeys.list("r"))).toBeUndefined();
    api.read.mockClear();
    await recovery.refresh("all");
    expect(api.read).not.toHaveBeenCalled();
  },
);
it("record-only 404 and authentication errors do not revoke the room", () => {
  const client = new QueryClient();
  const recovery = getExpenseRecovery(client, "r");
  recovery.handleError({ status: 404, code: "EXPENSE_NOT_FOUND" });
  expect(recovery.getSnapshot()).not.toBe("revoked");
  recovery.handleError({ status: 401, code: "INVALID_TOKEN" });
  expect(recovery.getSnapshot()).not.toBe("revoked");
});
it("a successful budget event cannot hide a failed expense read", async () => {
  const client = new QueryClient();
  const recovery = getExpenseRecovery(client, "r");
  await recovery.refresh("all");
  api.read.mockRejectedValueOnce(new Error("offline"));
  await expect(recovery.refresh("expenses")).rejects.toThrow();
  await recovery.refresh("budget");
  expect(recovery.getSnapshot()).toBe("error");
  await recovery.refresh("expenses");
  expect(recovery.getSnapshot()).toBe("ready");
  client.clear();
});
it("forced room exit stops recovery and fences late reads", async () => {
  const client = new QueryClient();
  const recovery = getExpenseRecovery(client, "r");
  let finish!: (v: never[]) => void;
  api.read.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const reading = recovery.refresh("budget").catch(() => {});
  await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
  const { evictRoomFromClientCaches } =
    await import("@/lib/stomp/forced-room-exit-dispatch");
  evictRoomFromClientCaches(client, "r");
  finish([]);
  await reading;
  expect(recovery.getSnapshot()).toBe("revoked");
  expect(client.getQueryData(expenseKeys.budget("r"))).toBeUndefined();
  client.clear();
});


it.each(["forced", "query-error"])(
  "%s revocation disposes the query-cache listener and stays terminal",
  async (source) => {
    const client = new QueryClient();
    const recovery = getExpenseRecovery(client, "r");
    // Observe delivery through the real cache, without replacing subscription.
    const handleError = vi.spyOn(recovery, "handleError");
    if (source === "forced") {
      const { evictRoomFromClientCaches } =
        await import("@/lib/stomp/forced-room-exit-dispatch");
      evictRoomFromClientCaches(client, "r");
    } else {
      await client.fetchQuery({
        queryKey: expenseKeys.budget("r"),
        queryFn: async () => { throw { status: 403 }; },
        retry: false,
      }).catch(() => {});
    }
    handleError.mockClear();
    const revision = recovery.listRevision;
    client.setQueryData(expenseKeys.list("r"), ["later-session"]);
    await client.fetchQuery({
      queryKey: expenseKeys.budget("r"),
      queryFn: async () => { throw new Error("later-session error"); },
      retry: false,
    }).catch(() => {});
    expect(handleError).not.toHaveBeenCalled();
    expect(recovery.listRevision).toBe(revision);
    expect(getExpenseRecovery(client, "r")).toBe(recovery);
    expect(recovery.getSnapshot()).toBe("revoked");
    api.read.mockClear();
    await recovery.refresh("all");
    expect(api.read).not.toHaveBeenCalled();
    handleError.mockRestore();
    client.clear();
  },
);

it("fresh server admission replaces a revoked lifetime, leaving old work terminal", async () => {
  const client = new QueryClient();
  const old = getExpenseRecovery(client, "r");
  old.revoke();
  const confirm = beginExpenseRoomAdmission(client);
  confirm("r", true);
  const fresh = getExpenseRecovery(client, "r");
  expect(fresh).not.toBe(old);
  await fresh.refresh("all");
  expect(fresh.getSnapshot()).toBe("ready");
  old.handleError({ status: 403 });
  await old.refresh("all");
  expect(old.getSnapshot()).toBe("revoked");
  expect(fresh.getSnapshot()).toBe("ready");
  expect(client.getQueryData(expenseKeys.list("r"))).toEqual([]);
  client.clear();
});
it.each([false, true])("admission authorized=%s cannot supersede a later forced exit", (authorized) => {
  const client = new QueryClient();
  const old = getExpenseRecovery(client, "r");
  const confirm = beginExpenseRoomAdmission(client);
  old.revoke();
  confirm("r", authorized);
  expect(getExpenseRecovery(client, "r")).toBe(old);
  expect(old.getSnapshot()).toBe("revoked");
  const afterExit = beginExpenseRoomAdmission(client);
  evictRoomFromClientCaches(client, "r");
  afterExit("r", true);
  expect(getExpenseRecovery(client, "r")).toBe(old);
});
it("denied fresh admission and cache success cannot replace a revoked lifetime", () => {
  const client = new QueryClient();
  const old = getExpenseRecovery(client, "r");
  old.revoke();
  beginExpenseRoomAdmission(client)("r", false);
  client.setQueryData(expenseKeys.list("r"), []);
  expect(getExpenseRecovery(client, "r")).toBe(old);
  expect(old.getSnapshot()).toBe("revoked");
  client.clear();
});

it("late revoked-controller errors cannot invalidate a fresh admission in flight", () => {
  const client = new QueryClient();
  const old = getExpenseRecovery(client, "r");
  old.revoke();
  const confirm = beginExpenseRoomAdmission(client);
  old.handleError({ status: 403 });
  confirm("r", true);
  expect(getExpenseRecovery(client, "r")).not.toBe(old);
  client.clear();
});


it.each(["members", "currencies"])(
  "visible revalidation retries failed %s before reporting ready",
  async (dependency) => {
    const client = new QueryClient();
    const recovery = getExpenseRecovery(client, "r");
    api.read.mockImplementation(async (key) => {
      if (key === dependency) throw new Error("offline");
      return [];
    });
    try {
      await expect(recovery.refresh("all")).rejects.toThrow("offline");
      expect(recovery.getSnapshot()).toBe("error");
      api.read.mockResolvedValue([]);
      await recovery.refresh("budget");
      expect(recovery.getSnapshot()).toBe("error");
      await recovery.refresh("visible");
      expect(client.getQueryState(["room-expenses", "r", dependency])?.status).toBe("success");
      expect(recovery.getSnapshot()).toBe("ready");
    } finally {
      api.read.mockResolvedValue([]);
      client.clear();
    }
  },
);
