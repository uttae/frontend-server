import { evictRoomFromClientCaches } from "@/lib/stomp/forced-room-exit-dispatch";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
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
const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  vi.clearAllMocks();
});
const READ_KEYS = ["list", "summary", "summary-krw", "budget", "currencies", "members"];
/**
 * ExpenseProvider가 화면에 붙이는 6개 조회와 같은 key·옵션의 observer를 붙인다.
 * 복구는 무효화만 하고, 다시 받는 일은 화면에 있는 조회(이 observer)의 queryFn이 한다.
 */
function mountExpenseQueries(client: QueryClient, roomId = "r") {
  for (const key of READ_KEYS) {
    const observer = new QueryObserver(client, {
      queryKey: [...expenseKeys.room(roomId), key],
      queryFn: () => api.read(key),
      retry: false,
      staleTime: Infinity,
    });
    stops.push(observer.subscribe(() => {}));
  }
}
/** observer를 붙이고 첫 조회가 끝날 때까지 기다린 뒤 읽기 기록을 비운다 */
async function loadedRecovery(client: QueryClient, roomId = "r") {
  const recovery = getExpenseRecovery(client, roomId);
  mountExpenseQueries(client, roomId);
  await recovery.refresh("all");
  api.read.mockClear();
  return recovery;
}
it("refreshes the six mounted queries once on entry and routes minimal own-session events", async () => {
  const client = new QueryClient();
  const recovery = getExpenseRecovery(client, "r");
  mountExpenseQueries(client);
  // 입장 복구는 observer가 막 시작한 첫 조회에 합류한다(6개 × 2가 아니다)
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
it("does not read queries that are not on screen; it only marks them for their next mount", async () => {
  const client = new QueryClient();
  const recovery = getExpenseRecovery(client, "r");
  client.setQueryData(expenseKeys.list("r"), []);
  await recovery.refresh("expenses");
  expect(api.read).not.toHaveBeenCalled();
  expect(client.getQueryState(expenseKeys.list("r"))?.isInvalidated).toBe(true);
  expect(recovery.getSnapshot()).toBe("ready");
  client.clear();
});
it("coalesces a burst but reruns events received during reads", async () => {
  const client = new QueryClient();
  const recovery = await loadedRecovery(client);
  let finish!: (v: never[]) => void;
  api.read.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const first = recovery.refresh("budget");
  await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
  // 읽는 중에 온 알림은 그 조회를 취소하고 다시 받는다. 같은 틱의 알림 여러 개는 한 번만 다시 받는다
  const second = recovery.refresh("budget");
  const third = recovery.refresh("budget");
  finish([]);
  await Promise.all([first, second, third]);
  expect(api.read).toHaveBeenCalledTimes(2);
  expect(recovery.getSnapshot()).toBe("ready");
  client.clear();
});
it("restarts a first load in flight when a change arrives instead of joining it", async () => {
  const client = new QueryClient();
  const recovery = getExpenseRecovery(client, "r");
  const reads: ((v: never[]) => void)[] = [];
  api.read.mockImplementation((key) =>
    key === "budget" ? new Promise((resolve) => reads.push(resolve)) : Promise.resolve([]),
  );
  try {
    mountExpenseQueries(client);
    await vi.waitFor(() => expect(reads).toHaveLength(1));
    // 처음 받는 중(데이터 없음)인 조회는 이 변경 전에 출발했을 수 있다
    const change = recovery.refresh("budget");
    await vi.waitFor(() => expect(reads).toHaveLength(2));
    reads[1]!([]);
    reads[0]!([]);
    await change;
    expect(recovery.getSnapshot()).toBe("ready");
  } finally {
    api.read.mockImplementation(async () => []);
    client.clear();
  }
});
it("rejects failed reads and does not report ready", async () => {
  const client = new QueryClient();
  const recovery = await loadedRecovery(client);
  api.read.mockRejectedValueOnce(new Error("offline"));
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
    const recovery = await loadedRecovery(client);
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
  const recovery = await loadedRecovery(client);
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
  const recovery = await loadedRecovery(client);
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
  // 새 입장의 화면이 조회를 다시 붙인다
  mountExpenseQueries(client);
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
      mountExpenseQueries(client);
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

it("revalidates a ready room in the background and coalesces overlapping tab-return events", async () => {
 const client = new QueryClient();
 const recovery = await loadedRecovery(client);
 let finish!: (value: never[]) => void;
 api.read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
 const first = recovery.refresh("visible");
 try {
  await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
  expect(recovery.getSnapshot()).toBe("refreshing");
  const second = recovery.refresh("visible");
  expect(second).toBe(first);
  finish([]);
  await Promise.all([first, second]);
  expect(api.read).toHaveBeenCalledTimes(6);
  expect(recovery.getSnapshot()).toBe("ready");
 } finally {
  finish?.([]);
  await first.catch(() => {});
  client.clear();
 }
});

it("promotes background revalidation to pending for a real expense change", async () => {
 const client = new QueryClient();
 const recovery = await loadedRecovery(client);
 let finish!: (value: never[]) => void;
 api.read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
 const first = recovery.refresh("visible");
 try {
  await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
  expect(recovery.getSnapshot()).toBe("refreshing");
  const change = recovery.message(JSON.stringify({ roomId: "r", type: "EXPENSES_INVALIDATED" }));
  expect(recovery.getSnapshot()).toBe("pending");
  finish([]);
  await Promise.all([first, change]);
  expect(recovery.getSnapshot()).toBe("ready");
 } finally {
  finish?.([]);
  await first.catch(() => {});
  client.clear();
 }
});
