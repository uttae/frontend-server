import { useEffect } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
const stomp = vi.hoisted(() => ({
  connected: true,
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}));
const stompClient = { subscribe: stomp.subscribe };
vi.mock("@/contexts/StompContext", () => ({
  useStompContext: () => ({ connected: stomp.connected, client: stompClient }),
}));
beforeEach(() => {
  stomp.connected = true;
  stomp.subscribe.mockReset();
  stomp.unsubscribe.mockReset();
  stomp.subscribe.mockReturnValue({ unsubscribe: stomp.unsubscribe });
});
const mocks = vi.hoisted(() => ({
  members: vi.fn<() => Promise<unknown>>(() => new Promise(() => {})),
  list: vi.fn<() => Promise<Expense[]>>(async () => []),
  summary: vi.fn<() => Promise<unknown>>(async () => ({ currencies: [] })),
  budget: vi.fn(async () => ({
    budgetKrw: null as string | null,
    currency: "KRW",
    version: 0,
  })),
  krw: vi.fn(async () => ({
    originalTotals: [],
    convertedTotalKrw: "0",
    rateDate: null,
    rateSource: "ECB",
    stale: true,
    missingCurrencies: [],
    isComplete: true,
  })),
  putBudget: vi.fn(),
  patch: vi.fn(),
  remove: vi.fn(),
  create: vi.fn(),
}));
vi.mock("@/hooks/useSessionUser", () => ({
  useSessionUser: () => ({ data: { id: 1 } }),
}));
vi.mock("@/hooks/useRooms", () => ({
  useRoomSchedules: () => ({
    data: [],
    isSuccess: true,
    refetch: async () => ({ data: [] }),
  }),
}));
vi.mock("@/lib/api/rooms/members", () => ({ getRoomMembers: mocks.members }));
vi.mock("@/lib/api/rooms/expenses", () => ({
  getExpenses: mocks.list,
  getExpenseBudget: mocks.budget,
  getExpenseKrwSummary: mocks.krw,
  putExpenseBudget: mocks.putBudget,
  getExpenseSummary: mocks.summary,
  getExpenseCurrencies: async () => [],
  createExpense: mocks.create,
  patchExpense: mocks.patch,
  deleteExpense: mocks.remove,
}));
import { ExpenseProvider, useExpenseContext } from "./ExpenseProvider";
function Probe() {
  const c = useExpenseContext();
  return (
    <p>
      {c.memberStatus}:{String(c.canManage)}
    </p>
  );
}
let renderer: ReactTestRenderer;
let client: QueryClient;
afterEach(async () => {
  await act(async () => renderer?.unmount());
  client?.clear();
  vi.unstubAllGlobals();
});
it("does not treat partial STOMP member cache as a successful full member query", async () => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["room-members", "r"], {
    members: [
      { userId: 1, status: "ACTIVE", role: "HOST", nickname: "partial" },
    ],
  });
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={client}>
        <ExpenseProvider roomId="r">
          <Probe />
        </ExpenseProvider>
      </QueryClientProvider>,
    );
  });
  expect(renderer.root.findByType("p").children.join("")).toBe("pending:false");
});

import type { Expense } from "@/lib/api/rooms/expenses";
import { expenseKeys } from "@/lib/expenses/expense-queries";
let context: ReturnType<typeof useExpenseContext>;
function MutationProbe() {
  const value = useExpenseContext();
  useEffect(() => {
    context = value;
  }, [value]);
  return null;
}
const record: Expense = {
  id: 10,
  version: 2,
  expenseGroup: "PREPARATION",
  scheduleId: null,
  scheduleItemId: null,
  currency: "KRW",
  totalAmount: "100",
  category: "OTHER",
  memo: "old",
  payerUserIds: [1],
  participantUserIds: [1],
  createdAt: "",
  updatedAt: "",
};
async function mountMutations() {
  mocks.members.mockResolvedValue({
    members: [{ userId: 1, role: "HOST", status: "ACTIVE" }],
  });
  mocks.list.mockResolvedValue([record]);
  mocks.summary.mockResolvedValue({ currencies: [] });
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={client}>
        <ExpenseProvider roomId="r">
          <MutationProbe />
        </ExpenseProvider>
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(context.canManage).toBe(true);
}
it("forwards the reviewed version and reflects PATCH before summary refresh completes", async () => {
  await mountMutations();
  const updated = { ...record, version: 3, memo: "saved" };
  mocks.patch.mockResolvedValueOnce(updated);
  let finishList!: (value: Expense[]) => void;
  mocks.list.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishList = resolve;
      }),
  );
  let finish!: (value: unknown) => void;
  mocks.summary.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let saving!: Promise<void>;
  await act(async () => {
    saving = context.save({ ...record, memo: "saved" }, 10, 2);
  });
  expect(mocks.patch).toHaveBeenLastCalledWith(
    "r",
    10,
    expect.objectContaining({ expectedVersion: 2 }),
  );
  expect(client.getQueryData(expenseKeys.list("r"))).toEqual([updated]);
  await act(async () => {
    finishList([updated]);
    finish({ currencies: [] });
    await saving;
  });
});
it("uses a fresh list read for recovery and propagates read failure without returning cached data", async () => {
  await mountMutations();
  mocks.list.mockResolvedValueOnce([{ ...record, version: 8 }]);
  await expect(context.readLatest(10)).resolves.toMatchObject({ version: 8 });
  mocks.list.mockRejectedValueOnce(new Error("offline"));
  await expect(context.readLatest(10)).rejects.toThrow("offline");
  mocks.list.mockResolvedValueOnce([]);
  await expect(context.readLatest(10)).resolves.toBeUndefined();
});
it("forwards DELETE reviewed version and removes the record before summary refresh", async () => {
  await mountMutations();
  mocks.remove.mockResolvedValueOnce(undefined);
  let finishList!: (value: Expense[]) => void;
  mocks.list.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishList = resolve;
      }),
  );
  let finish!: (value: unknown) => void;
  mocks.summary.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let deleting!: Promise<void>;
  await act(async () => {
    deleting = context.remove(record);
  });
  expect(mocks.remove).toHaveBeenLastCalledWith("r", 10, 2);
  expect(client.getQueryData(expenseKeys.list("r"))).toEqual([]);
  await act(async () => {
    finishList([]);
    finish({ currencies: [] });
    await deleting;
  });
});

it("loads both reference queries and includes them in normal refresh", async () => {
  await mountMutations();
  expect(context.budget.data).toMatchObject({ budgetKrw: null, version: 0 });
  expect(context.krwSummary.data).toMatchObject({ convertedTotalKrw: "0" });
  const reads = [mocks.budget.mock.calls.length, mocks.krw.mock.calls.length];
  await act(async () => {
    await context.refresh();
  });
  expect(mocks.budget.mock.calls.length).toBeGreaterThan(reads[0]);
  expect(mocks.krw.mock.calls.length).toBeGreaterThan(reads[1]);
});
it("saves as ACTIVE MEMBER, guards duplicate writes and installs PUT result", async () => {
  await mountMutations();
  mocks.members.mockResolvedValue({
    members: [{ userId: 1, role: "MEMBER", status: "ACTIVE" }],
  });
  await act(async () => {
    await context.refresh();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(context.canManage).toBe(true);
  expect(context.members[0].role).toBe("MEMBER");
  let finish!: (value: unknown) => void;
  mocks.putBudget.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let saving!: Promise<unknown>;
  await act(async () => {
    saving = context.saveBudget({ budgetKrw: "0", expectedVersion: 0 });
  });
  await expect(
    context.saveBudget({ budgetKrw: "10", expectedVersion: 0 }),
  ).rejects.toThrow();
  expect(mocks.putBudget).toHaveBeenLastCalledWith("r", {
    budgetKrw: "0",
    expectedVersion: 0,
  });
  await act(async () => {
    finish({ budgetKrw: "0", currency: "KRW", version: 1 });
    await saving;
  });
  expect(client.getQueryData(expenseKeys.budget("r"))).toEqual({
    budgetKrw: "0",
    currency: "KRW",
    version: 1,
  });
});
it("fresh budget recovery propagates failure instead of accepting cached budget", async () => {
  await mountMutations();
  mocks.budget.mockResolvedValueOnce({
    budgetKrw: "20",
    currency: "KRW",
    version: 7,
  });
  await expect(context.readLatestBudget()).resolves.toMatchObject({
    budgetKrw: "20",
    version: 7,
  });
  mocks.budget.mockRejectedValueOnce(new Error("offline"));
  await expect(context.readLatestBudget()).rejects.toThrow("offline");
});
it("does not permit budget writes after member access is lost", async () => {
  await mountMutations();
  mocks.members.mockResolvedValue({
    members: [{ userId: 1, role: "MEMBER", status: "LEFT" }],
  });
  await act(async () => {
    await context.refresh();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(context.canManage).toBe(false);
  const before = mocks.putBudget.mock.calls.length;
  await expect(
    context.saveBudget({ budgetKrw: "1", expectedVersion: 0 }),
  ).rejects.toThrow();
  expect(mocks.putBudget.mock.calls.length).toBe(before);
});

it("subscribes to the exact expense topic and consumes minimal events from own sessions", async () => {
  await mountMutations();
  expect(stomp.subscribe).toHaveBeenCalledWith(
    "/topic/rooms/r/expenses",
    expect.any(Function),
  );
  const before = mocks.list.mock.calls.length;
  await act(async () => {
    stomp.subscribe.mock.lastCall![1]({
      body: JSON.stringify({ roomId: "r", type: "EXPENSES_INVALIDATED" }),
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(mocks.list.mock.calls.length).toBeGreaterThan(before);
});
it("disconnect hides synchronized status and revocation stops subscription and closes expense children", async () => {
  await mountMutations();
  expect(context.syncStatus).toBe("ready");
  stomp.connected = false;
  await act(async () => {
    renderer.update(
      <QueryClientProvider client={client}>
        <ExpenseProvider roomId="r">
          <MutationProbe />
        </ExpenseProvider>
      </QueryClientProvider>,
    );
  });
  expect(context.syncStatus).toBe("disconnected");
  expect(stomp.unsubscribe).toHaveBeenCalled();
  await act(async () => {
    getExpenseRecovery(client, "r").revoke();
  });
  expect(client.getQueryData(expenseKeys.list("r"))).toBeUndefined();
  expect(renderer.toJSON()).toBeNull();
});
it("late PATCH cannot replace a newer version read during its request", async () => {
  await mountMutations();
  let finish!: (value: Expense) => void;
  mocks.patch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let saving!: Promise<void>;
  await act(async () => {
    saving = context.save({ ...record }, 10, 2);
  });
  mocks.list.mockResolvedValue([{ ...record, version: 9, memo: "newer" }]);
  await act(async () => {
    await context.refresh();
  });
  await act(async () => {
    finish({ ...record, version: 3, memo: "late" });
    await saving;
  });
  expect(
    client.getQueryData<Expense[]>(expenseKeys.list("r"))?.[0],
  ).toMatchObject({ version: 9, memo: "newer" });
});
import { beginExpenseRoomAdmission, getExpenseRecovery } from "@/lib/expenses/expense-recovery";
it("late PUT never replaces a newer explicit recovery read while trailing GET is pending", async () => {
  await mountMutations();
  let finish!: (value: unknown) => void;
  mocks.putBudget.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let saving!: Promise<unknown>;
  await act(async () => {
    saving = context.saveBudget({ budgetKrw: "100", expectedVersion: 0 });
  });
  const newer = { budgetKrw: "900", currency: "KRW", version: 9 };
  mocks.budget.mockResolvedValueOnce(newer);
  await act(async () => {
    await context.readLatestBudget();
  });
  let finishRead!: (value: typeof newer) => void;
  mocks.budget.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishRead = resolve;
      }),
  );
  await act(async () => {
    finish({ budgetKrw: "100", currency: "KRW", version: 1 });
  });
  expect(client.getQueryData(expenseKeys.budget("r"))).toEqual(newer);
  await act(async () => {
    finishRead(newer);
    await saving;
  });
});
it("installs a newer own PUT immediately even if an unrelated summary read completed during it", async () => {
  await mountMutations();
  let finish!: (value: unknown) => void;
  mocks.putBudget.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let saving!: Promise<unknown>;
  await act(async () => {
    saving = context.saveBudget({ budgetKrw: "700", expectedVersion: 0 });
  });
  await act(async () => {
    await getExpenseRecovery(client, "r").refresh("expenses");
  });
  // A conservative generation-only fence would wait for this GET and hide the committed own response.
  let finishRead!: (value: {
    budgetKrw: string;
    currency: string;
    version: number;
  }) => void;
  mocks.budget.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishRead = resolve;
      }),
  );
  const saved = { budgetKrw: "700", currency: "KRW", version: 1 };
  await act(async () => {
    finish(saved);
  });
  expect(client.getQueryData(expenseKeys.budget("r"))).toEqual(saved);
  if (finishRead) finishRead(saved);
  await act(async () => {
    await saving;
  });
  mocks.budget
    .mockReset()
    .mockResolvedValue({ budgetKrw: null, currency: "KRW", version: 0 });
});
it("an older in-flight GET cannot overwrite the immediate committed PATCH", async () => {
  await mountMutations();
  let oldRead!: (value: Expense[]) => void;
  mocks.list.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        oldRead = resolve;
      }),
  );
  let reading!: Promise<unknown>;
  await act(async () => {
    reading = client.refetchQueries({
      queryKey: expenseKeys.list("r"),
      exact: true,
    });
  });
  let freshRead!: (value: Expense[]) => void;
  mocks.list.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        freshRead = resolve;
      }),
  );
  const saved = { ...record, version: 3, memo: "committed" };
  mocks.patch.mockResolvedValueOnce(saved);
  let saving!: Promise<void>;
  await act(async () => {
    saving = context.save(saved, 10, 2);
  });
  expect(client.getQueryData(expenseKeys.list("r"))).toEqual([saved]);
  await act(async () => {
    oldRead([record]);
    await reading;
  });
  expect(client.getQueryData(expenseKeys.list("r"))).toEqual([saved]);
  await act(async () => {
    freshRead([saved]);
    await saving;
  });
});
it("revocation during a mutation prevents its response from repopulating caches", async () => {
  await mountMutations();
  let finish!: (value: Expense) => void;
  mocks.patch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let saving!: Promise<void>;
  await act(async () => {
    saving = context.save(record, 10, 2);
  });
  await act(async () => {
    getExpenseRecovery(client, "r").revoke();
    finish({ ...record, version: 3 });
    await saving;
  });
  expect(client.getQueryData(expenseKeys.list("r"))).toBeUndefined();
  expect(renderer.toJSON()).toBeNull();
});
it("keeps a committed create successful when its follow-up summary read fails", async () => {
  await mountMutations();
  const saved = { ...record, id: 11, version: 0 };
  mocks.create.mockResolvedValueOnce(saved);
  mocks.list.mockResolvedValueOnce([record, saved]);
  mocks.summary.mockRejectedValueOnce(new Error("offline"));
  await act(async () => {
    await expect(context.save(saved)).resolves.toBeUndefined();
  });
  expect(client.getQueryData<Expense[]>(expenseKeys.list("r"))).toContainEqual(
    saved,
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(context.syncStatus).toBe("error");
});

it("new authorized lifetime permits writes while late old PATCH and PUT stay fenced", async () => {
  await mountMutations();
  const old = getExpenseRecovery(client, "r");
  let finishPatch!: (value: Expense) => void;
  let finishBudget!: (value: unknown) => void;
  mocks.patch.mockImplementationOnce(() => new Promise(resolve => { finishPatch = resolve; }));
  mocks.putBudget.mockImplementationOnce(() => new Promise(resolve => { finishBudget = resolve; }));
  let saving!: Promise<void>;
  let budgeting!: Promise<unknown>;
  await act(async () => {
    saving = context.save(record, 10, 2);
    budgeting = context.saveBudget({ budgetKrw: "100", expectedVersion: 0 });
  });
  await act(async () => { old.revoke(); });
  const freshRecord = { ...record, version: 20, memo: "new lifetime" };
  const freshBudget = { budgetKrw: "200", currency: "KRW", version: 20 };
  mocks.list.mockResolvedValue([freshRecord]);
  mocks.budget.mockResolvedValue(freshBudget);
  await act(async () => { beginExpenseRoomAdmission(client)("r", true); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  expect(context.canManage).toBe(true);
  expect(context.syncStatus).toBe("ready");
  await act(async () => {
    finishPatch({ ...record, version: 99, memo: "late old" });
    finishBudget({ budgetKrw: "999", currency: "KRW", version: 99 });
    await Promise.all([saving, budgeting]);
  });
  expect(client.getQueryData(expenseKeys.list("r"))).toEqual([freshRecord]);
  expect(client.getQueryData(expenseKeys.budget("r"))).toEqual(freshBudget);
  mocks.putBudget.mockResolvedValueOnce({ ...freshBudget, version: 21 });
  await act(async () => { await context.saveBudget({ budgetKrw: "200", expectedVersion: 20 }); });
  expect(client.getQueryData(expenseKeys.budget("r"))).toMatchObject({ version: 21 });
  expect(old.getSnapshot()).toBe("revoked");
});
