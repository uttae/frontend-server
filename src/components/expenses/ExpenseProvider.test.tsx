import { useEffect } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
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
  expect(renderer.root.findByType("p").children.join("")).toBe(
    "pending:false",
  );
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
