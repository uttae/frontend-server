import { useEffect } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
const mocks = vi.hoisted(() => ({
  members: vi.fn<() => Promise<unknown>>(() => new Promise(() => {})),
  list: vi.fn<() => Promise<Expense[]>>(async () => []),
  summary: vi.fn<() => Promise<unknown>>(async () => ({ currencies: [] })),
  patch: vi.fn(),
  remove: vi.fn(),
  create: vi.fn(),
}));
vi.mock("@/hooks/useSessionUser", () => ({
  useSessionUser: () => ({ data: { id: 1 } }),
}));
vi.mock("@/hooks/useRooms", () => ({
  useRoomSchedules: () => ({ data: [], isSuccess: true }),
}));
vi.mock("@/lib/api/rooms/members", () => ({ getRoomMembers: mocks.members }));
vi.mock("@/lib/api/rooms/expenses", () => ({
  getExpenses: mocks.list,
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
