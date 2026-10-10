import { useEffect } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setSessionUserCache } from "@/lib/session-user-cache";
import { tearDownClientSession } from "@/lib/client-storage";
import { scheduleItemsQueryKey } from "@/lib/query-keys";
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
  krw: vi.fn<(...args: unknown[]) => Promise<ExpenseKrwSummary>>(async () => ({
    expenses: [], categories: [], days: [], payers: [],
    filtered: { originalTotals: [], convertedTotalKrw: "0", isComplete: true, missingCurrencies: [] },
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
  useSessionUser: () => ({ data: analytics.userId === undefined ? undefined : { id: analytics.userId } }),
}));
vi.mock("@/hooks/useRooms", () => ({
  useSchedulePlanPlaces: () => ({ data: [], isSuccess: true }),
  useDeleteRoomSchedule: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateRoomSchedule: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRoomSchedules: () => ({
    data: [],
    isSuccess: true,
    refetch: async () => ({ data: [] }),
  }),
}));
vi.mock("@/lib/api/rooms/members", () => ({ getRoomMembers: mocks.members }));
vi.mock("@/lib/api/rooms/expenses", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api/rooms/expenses")>(),
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
const analytics = vi.hoisted(() => ({ send: vi.fn(), userId: 1 as number | undefined }));
vi.mock("@/lib/analytics/client", () => ({ sendAnalyticsDataCommand: analytics.send }));
beforeEach(() => { analytics.send.mockClear(); analytics.userId = 1; });
import { ExpensePanel } from "./ExpensePanel";
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

import type { Expense, ExpenseKrwSummary } from "@/lib/api/rooms/expenses";
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
  name: null, createdAt: "",
  updatedAt: "",
};
async function mountMutations(options: { panel?: boolean; summary?: () => Promise<unknown> } = {}) {
  mocks.members.mockResolvedValue({
    members: [{ userId: 1, role: "HOST", status: "ACTIVE" }],
  });
  mocks.list.mockResolvedValue([record]);
  mocks.summary.mockReset().mockImplementation(options.summary ?? (async () => ({ currencies: [] })));
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  setSessionUserCache(client, { id: 1, email: "", nickname: "", profileImageUrl: null, provider: "GOOGLE", tutorialCompleted: true });
  useSessionStore.setState({ sessionReady: true, currentRoomId: "r" });
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={client}>
        <ExpenseProvider roomId="r">
          <MutationProbe />
          {options.panel && <ExpensePanel />}
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
  expect(analytics.send.mock.calls).toEqual([["event", "expense_updated", { room_id: "r" }]]);
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
  expect(analytics.send.mock.calls).toEqual([["event", "expense_deleted", { room_id: "r" }]]);
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
  expect(analytics.send).not.toHaveBeenCalled();
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
  expect(analytics.send.mock.calls).toEqual([["event", "expense_budget_saved", { room_id: "r" }]]);
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
  expect(mocks.putBudget.mock.calls).toHaveLength(before);
  expect(analytics.send).not.toHaveBeenCalled();
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
  expect(analytics.send).not.toHaveBeenCalled();
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
  expect(analytics.send.mock.calls).toEqual([["event", "expense_updated", { room_id: "r" }]]);
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
  expect(analytics.send.mock.calls).toEqual([["event", "expense_budget_saved", { room_id: "r" }]]);
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
  expect(analytics.send.mock.calls).toEqual([["event", "expense_created", { room_id: "r" }]]);
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

const gateState = vi.hoisted(() => ({ roomId: "r" as string | null, roomContextReady: true }));
const gateRouter = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/link", () => ({ default: ({ children, href }: React.ComponentProps<"a">) => <a href={href}>{children}</a> }));
vi.mock("next/navigation", () => ({ useRouter: () => gateRouter }));
vi.mock("@/hooks/use-room-id", () => ({ useCurrentRoomId: () => gateState }));
vi.mock("@/hooks/useChatPanelOpen", () => ({ useChatPanelOpen: () => true }));
vi.mock("@/lib/rooms", () => ({ validateRoomAccess: async () => "ok" }));
import { MainRoomGate } from "@/components/layout/MainRoomGate";
import { ExpenseEntryButton } from "./ExpenseProvider";
import { ExpenseScopePanel } from "./ExpenseScopePanel";
import { ExpensePlaceLabel } from "./ExpensePlaceLabel";
import { useSessionStore } from "@/stores/session-store";

it("shares one room subscription across route children and resets it on selected-room changes", async () => {
  gateState.roomId = "r";
  gateState.roomContextReady = false;
  useSessionStore.setState({ sessionReady: true });
  mocks.members.mockResolvedValue({ members: [{ userId: 1, role: "HOST", status: "ACTIVE" }] });
  mocks.list.mockResolvedValue([]);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = (label: string) => <QueryClientProvider client={client}><MainRoomGate><ExpenseEntryButton label={label} scheduleId={10} scheduleItemId={20} /></MainRoomGate></QueryClientProvider>;
  await act(async () => { renderer = create(tree("장소 비용")); });
  expect(renderer.toJSON()).toBeNull();
  expect(stomp.subscribe).not.toHaveBeenCalled();
  gateState.roomContextReady = true;
  await act(async () => { renderer.update(tree("장소 비용")); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  expect(renderer.root.findAllByType("button").some(b => b.children.join("").includes("장소 비용"))).toBe(true);
  expect(stomp.subscribe).toHaveBeenCalledTimes(1);
  expect(stomp.subscribe.mock.calls[0][0]).toBe("/topic/rooms/r/expenses");
  await act(async () => { renderer.update(tree("일차 비용")); });
  expect(stomp.subscribe).toHaveBeenCalledTimes(1);
  expect(stomp.unsubscribe).not.toHaveBeenCalled();
  await act(async () => renderer.root.findByType("button").props.onClick({ stopPropagation: () => {} }));
  expect(renderer.root.findAllByType(ExpenseEditor)).toHaveLength(1);
  gateState.roomId = "other";
  await act(async () => { renderer.update(tree("다른 방")); });
  expect(renderer.root.findAllByType(ExpenseEditor)).toHaveLength(0);
  expect(stomp.unsubscribe).toHaveBeenCalledTimes(1);
  expect(stomp.subscribe).toHaveBeenCalledTimes(2);
  expect(stomp.subscribe.mock.lastCall![0]).toBe("/topic/rooms/other/expenses");
  gateState.roomId = null;
  await act(async () => { renderer.update(tree("선택 안 됨")); });
  expect(renderer.toJSON()).toBeNull();
  expect(stomp.unsubscribe).toHaveBeenCalledTimes(2);
  expect(gateRouter.replace).toHaveBeenCalledWith("/home");
});

vi.mock("@/hooks/useRoomDetail", () => ({ useRoomDetail: () => ({ data: undefined }) }));
vi.mock("@/hooks/usePlanScheduleDayReorder", () => ({ usePlanScheduleDayReorder: () => ({ getSectionProps: () => ({}), listContainerProps: {}, isMovePending: false }) }));
vi.mock("@/app/(main)/plan/_components/itinerary/PlanScheduleDayBlock", () => ({ PlanScheduleDayBlock: () => null }));
import { PlanPageView } from "@/app/(main)/plan/_components/itinerary/PlanPageView";
import { ExpenseEditor } from "./ExpenseEditor";

it("mobile plan shares the provider with the cost page while day/place entries keep their target", async () => {
  gateState.roomId = "r";
  useSessionStore.setState({ sessionReady: true, currentRoomId: "r" });
  mocks.members.mockResolvedValue({ members: [{ userId: 1, role: "HOST", status: "ACTIVE" }] });
  mocks.list.mockResolvedValue([]);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => { renderer = create(<QueryClientProvider client={client}><MainRoomGate><PlanPageView /><ExpenseEntryButton scheduleId={10} label="일차 비용" /><ExpenseEntryButton scheduleId={10} scheduleItemId={20} label="장소 비용" /></MainRoomGate></QueryClientProvider>); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  expect(renderer.root.findAllByType("a").some(a => a.props.href === "/cost")).toBe(false);
  expect(stomp.subscribe).toHaveBeenCalledTimes(1);
  for (const [label, initial] of [["일차 비용", { scheduleId: 10 }], ["장소 비용", { scheduleId: 10, scheduleItemId: 20 }]] as const) {
    const button = renderer.root.findAllByType("button").find(b => b.children.join("").includes(label))!;
    await act(async () => button.props.onClick({ stopPropagation: () => {} }));
    expect(renderer.root.findAllByType(ExpenseEditor)).toHaveLength(1);
    expect(renderer.root.findByType(ExpenseEditor).props.initial).toEqual(initial);
    await act(async () => renderer.root.findByType(ExpenseEditor).props.onClose());
  }
  const { default: CostPage } = await import("@/app/(main)/cost/page");
  await act(async () => { renderer.update(<QueryClientProvider client={client}><MainRoomGate><CostPage /></MainRoomGate></QueryClientProvider>); });
  expect(renderer.root.findByType("h1").children).toEqual(["가계부"]);
  expect(stomp.subscribe).toHaveBeenCalledTimes(1);
  expect(stomp.unsubscribe).not.toHaveBeenCalled();
});

it("cost page hides healthy refresh and retries failed reads through the same provider", async () => {
  const { default: CostPage } = await import("@/app/(main)/cost/page");
  gateState.roomId = "r";
  useSessionStore.setState({ sessionReady: true });
  mocks.members.mockResolvedValue({ members: [{ userId: 1, role: "HOST", status: "ACTIVE" }] });
  mocks.list.mockResolvedValue([record]);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => { renderer = create(<QueryClientProvider client={client}><MainRoomGate><CostPage /></MainRoomGate></QueryClientProvider>); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  expect(renderer.root.findByType("h1").children).toEqual(["가계부"]);
  expect(JSON.stringify(renderer.toJSON())).toContain("old");
  expect(stomp.subscribe).toHaveBeenCalledTimes(1);
  expect(renderer.root.findAllByType("button").filter(b => /새로고침|조회 다시 시도/.test(b.props["aria-label"] ?? ""))).toHaveLength(0);
  mocks.list.mockRejectedValue(new Error("list offline"));
  await act(async () => { await expect(getExpenseRecovery(client, "r").refresh("all")).rejects.toThrow("list offline"); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  expect(JSON.stringify(renderer.toJSON())).toContain("list offline");
  mocks.list.mockResolvedValue([{ ...record, memo: "recovered expense" }]);
  const previousKrw = mocks.krw.getMockImplementation()!;
  mocks.krw.mockImplementation(async () => ({
    ...await previousKrw(),
    expenses: [{ expense: { ...record, memo: "recovered expense" }, convertedAmountKrw: "100", missingCurrencies: [], isComplete: true }],
  }));
  const retry = renderer.root.findAllByType("button").find(b => b.props["aria-label"] === "조회 다시 시도");
  expect(retry).toBeDefined();
  await act(async () => { retry!.props.onClick(); await new Promise(resolve => setTimeout(resolve, 20)); });
  expect(JSON.stringify(renderer.toJSON())).toContain("recovered expense");
  mocks.krw.mockImplementation(previousKrw);
  expect(renderer.root.findAllByType("button").filter(b => /새로고침|조회 다시 시도/.test(b.props["aria-label"] ?? ""))).toHaveLength(0);
});


it.each(["reconnect", "visible"])(
  "recovers failed members and editing permissions on %s without manual refresh",
  async (trigger) => {
    await mountMutations();
    mocks.members.mockRejectedValue(new Error("offline"));
    await act(async () => {
      await client.refetchQueries({ queryKey: expenseKeys.members("r"), exact: true });
    });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(context.memberStatus).toBe("error");
    expect(context.canManage).toBe(false);
    expect(context.syncStatus).toBe("error");
    mocks.members.mockResolvedValue({
      members: [{ userId: 1, role: "HOST", status: "ACTIVE" }],
    });
    if (trigger === "reconnect") {
      const render = () => (
        <QueryClientProvider client={client}>
          <ExpenseProvider roomId="r"><MutationProbe /></ExpenseProvider>
        </QueryClientProvider>
      );
      stomp.connected = false;
      await act(async () => { renderer.update(render()); });
      stomp.connected = true;
      await act(async () => { renderer.update(render()); });
    } else {
      const { getExpenseRecovery } = await import("@/lib/expenses/expense-recovery");
      await act(async () => { await getExpenseRecovery(client, "r").refresh("visible"); });
    }
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(context.memberStatus).toBe("success");
    expect(context.canManage).toBe(true);
    expect(context.syncStatus).toBe("ready");
  },
);

async function mountPlaceExpenseButton(records: Expense[]) {
  await mountMutations();
  await act(async () => {
    client.setQueryData(expenseKeys.list("r"), records);
    renderer.update(
      <QueryClientProvider client={client}>
        <ExpenseProvider roomId="r">
          <ExpenseEntryButton scheduleId={2} scheduleItemId={3} label="비용 추가" />
        </ExpenseProvider>
      </QueryClientProvider>,
    );
  });
}

it("opens a place cost list instead of editing only the latest linked expense", async () => {
  const latest = { ...record, id: 12, scheduleId: 2, scheduleItemId: 3, totalAmount: "12345", name: null, createdAt: "2026-09-16T02:00:00Z" };
  await mountPlaceExpenseButton([
    latest,
    { ...latest, id: 99, name: null, createdAt: "2026-09-15T02:00:00Z", updatedAt: "2026-09-17T02:00:00Z" },
    { ...latest, id: 100, scheduleItemId: 4, name: null, createdAt: "2026-09-18T02:00:00Z" },
  ]);
  await act(async () => {
    client.setQueryData(scheduleItemsQueryKey("r", 2), [{ itemId: 3, title: "경복궁" }]);
  });
  const button = renderer.root.findByType("button");
  expect(button.children.join("")).toContain("비용 2건");
  expect(button.children.join("")).toContain("24,690 KRW");
  await act(async () => button.props.onClick({ stopPropagation() {} }));
  expect(renderer.root.findAllByType(ExpenseEditor)).toHaveLength(0);
  expect(renderer.root.findAllByType("h2").some(heading => heading.children.join("") === "장소 비용")).toBe(true);
  const panel = renderer.root.findByType(ExpenseScopePanel);
  expect(panel.findAllByType(ExpensePlaceLabel)).toHaveLength(2);
  expect(JSON.stringify(renderer.toJSON())).toContain("경복궁");
  const add = renderer.root.findByType(ExpenseScopePanel).findAllByType("button").find(b => b.children.join("").includes("비용 추가"))!;
  await act(async () => add.props.onClick());
  expect(renderer.root.findByType(ExpenseEditor).props.initial).toEqual({ scheduleId: 2, scheduleItemId: 3 });
  await act(async () => renderer.root.findByType(ExpenseEditor).props.onClose());
  const edits = renderer.root.findByType(ExpenseScopePanel).findAllByType("button").filter(b => b.props["aria-label"]?.endsWith("비용 수정"));
  expect(edits).toHaveLength(2);
  await act(async () => edits[1].props.onClick());
  expect(renderer.root.findByType(ExpenseEditor).props.initial.expense.id).toBe(99);
});

it("opens a day cost list with separate totals for each currency", async () => {
  await mountMutations();
  await act(async () => {
    client.setQueryData(expenseKeys.list("r"), [
      { ...record, id: 20, scheduleId: 2, scheduleItemId: 3, totalAmount: "1000", currency: "KRW" },
      { ...record, id: 21, scheduleId: 2, scheduleItemId: null, totalAmount: "2.50", currency: "USD" },
      { ...record, id: 22, scheduleId: 3, scheduleItemId: null, totalAmount: "500", currency: "KRW" },
    ]);
    renderer.update(
      <QueryClientProvider client={client}>
        <ExpenseProvider roomId="r"><ExpenseEntryButton scheduleId={2} scopeLabel="1일차" /></ExpenseProvider>
      </QueryClientProvider>,
    );
  });

  const button = renderer.root.findByType("button");
  expect(button.children.join("")).toContain("비용 2건 · 1,000 KRW · 2.50 USD");
  await act(async () => button.props.onClick({ stopPropagation() {} }));
  const panel = renderer.root.findByType(ExpenseScopePanel);
  expect(panel.findAllByType("h2")[0].children.join("")).toBe("1일차 비용");
  expect(panel.findAllByType("li")).toHaveLength(2);
  await act(async () => panel.findAllByType("button").find(b => b.children.join("").includes("비용 추가"))!.props.onClick());
  expect(renderer.root.findByType(ExpenseEditor).props.initial).toEqual({ scheduleId: 2 });
});

it("returns to add mode after the last linked expense is deleted", async () => {
  await mountPlaceExpenseButton([{ ...record, scheduleId: 2, scheduleItemId: 3 }]);
  await act(async () => {
    client.setQueryData(expenseKeys.list("r"), []);
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  const button = renderer.root.findByType("button");
  expect(button.children.join("")).toContain("비용 추가");
  await act(async () => button.props.onClick({ stopPropagation() {} }));
  expect(renderer.root.findByType(ExpenseEditor).props.initial).toEqual({ scheduleId: 2, scheduleItemId: 3 });
});

it("isolates AND-filtered KRW snapshots and refreshes them on expense invalidation without replacing the whole room", async () => {
  await mountMutations();
  const filters = { expenseGroup: "TRIP_DAY" as const, scheduleId: 10, category: "FOOD" as const };
  await act(async () => context.setKrwFilters(filters));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  expect(mocks.krw).toHaveBeenCalledWith("r", filters);
  expect(client.getQueryData(expenseKeys.krwSummary("r"))).toBeDefined();
  expect(client.getQueryData([...expenseKeys.krwSummary("r"), filters])).toBeDefined();
  mocks.krw.mockClear();
  const { getExpenseRecovery } = await import("@/lib/expenses/expense-recovery");
  await act(async () => getExpenseRecovery(client, "r").message(JSON.stringify({ roomId: "r", type: "EXPENSES_INVALIDATED" })));
  expect(mocks.krw).toHaveBeenCalledWith("r", filters);
  expect(mocks.krw).toHaveBeenCalledWith("r");
});

it("keeps whole-room state ready while a new filter snapshot loads", async () => {
 await mountMutations();
 const whole = context.krwSummary.data!;
 let finish!: (value: ExpenseKrwSummary) => void;
 mocks.krw.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
 const listReads = mocks.list.mock.calls.length;
 const budgetReads = mocks.budget.mock.calls.length;
 const summaryReads = mocks.summary.mock.calls.length;
 try {
  await act(async () => context.setKrwFilters({ expenseGroup: "TRIP_DAY", scheduleId: 10 }));
  expect(context.filteredKrwSummary.isFetching).toBe(true);
  expect(context.syncStatus).toBe("ready");
  expect(context.krwSummary.data).toBe(whole);
  expect(mocks.list).toHaveBeenCalledTimes(listReads);
  expect(mocks.budget).toHaveBeenCalledTimes(budgetReads);
  expect(mocks.summary).toHaveBeenCalledTimes(summaryReads);
 } finally {
  await act(async () => finish(whole));
 }
});

it("returns to all expenses without refetching or blanking the whole-room summary", async () => {
 await mountMutations();
 await act(async () => { context.setKrwFilters({ expenseGroup: "TRIP_DAY", scheduleId: 10 }); });
 await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
 const whole = context.krwSummary.data!;
 const previous = mocks.krw.getMockImplementation()!;
 let finish: ((value: ExpenseKrwSummary) => void) | undefined;
 mocks.krw.mockImplementation((...args) => args.length === 1 ? new Promise(resolve => { finish = resolve; }) : previous(...args));
 try {
  await act(async () => context.setKrwFilters({}));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  expect(finish).toBeUndefined();
  expect(context.krwSummary.isFetching).toBe(false);
  expect(context.syncStatus).toBe("ready");
  expect(context.krwSummary.data).toBe(whole);
 } finally {
  mocks.krw.mockImplementation(previous);
  if (finish) await act(async () => finish!(whole));
 }
});

it("never reports a foreground load during successful tab-return revalidation", async () => {
 await mountMutations();
 const statuses: string[] = [];
 function StatusProbe() {
  const value = useExpenseContext();
  useEffect(() => { statuses.push(value.syncStatus); }, [value.syncStatus]);
  return null;
 }
 await act(async () => renderer.update(<QueryClientProvider client={client}><ExpenseProvider roomId="r"><MutationProbe /><StatusProbe /></ExpenseProvider></QueryClientProvider>));
 const previous = context.krwSummary.data!;
 let finish!: (value: ExpenseKrwSummary) => void;
 mocks.krw.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
 const { getExpenseRecovery } = await import("@/lib/expenses/expense-recovery");
 let work!: Promise<void>;
 await act(async () => { work = getExpenseRecovery(client, "r").refresh("visible"); });
 try {
  expect(context.syncStatus).toBe("refreshing");
  expect(context.krwSummary.data).toBe(previous);
 } finally {
  await act(async () => { finish(previous); await work; });
 }
 await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
 expect(statuses).toContain("refreshing");
 expect(statuses).not.toContain("pending");
 expect(context.syncStatus).toBe("ready");
});


it("confirms a scoped expense deletion, supports cancel, and updates the card total", async () => {
  const linked = { ...record, scheduleId: 2, scheduleItemId: 3 };
  await mountPlaceExpenseButton([linked]);
  mocks.remove.mockReset();
  mocks.remove.mockResolvedValue(undefined);
  mocks.list.mockResolvedValue([]);
  await act(async () => renderer.root.findByType("button").props.onClick({ stopPropagation() {} }));
  const deleteButton = () => renderer.root.findAllByType("button").find(b => b.props["aria-label"]?.endsWith("비용 삭제"))!;
  expect(deleteButton()).toBeDefined();
  await act(async () => deleteButton().props.onClick());
  expect(mocks.remove).not.toHaveBeenCalled();
  await act(async () => renderer.root.findByProps({ "aria-label": "비용 삭제 취소" }).props.onClick());
  expect(mocks.remove).not.toHaveBeenCalled();
  await act(async () => deleteButton().props.onClick());
  await act(async () => renderer.root.findByProps({ "aria-label": "비용 삭제 확인" }).props.onClick());
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  expect(mocks.remove).toHaveBeenCalledExactlyOnceWith("r", 10, 2);
  expect(renderer.root.findByType(ExpenseScopePanel).findAllByType("li")).toHaveLength(0);
  expect(renderer.root.findAllByType(ExpenseEditor)).toHaveLength(0);
  expect(renderer.root.findByProps({ "aria-label": "장소 비용 추가" })).toBeDefined();
});


it("keeps a scoped expense after a failed delete and prevents duplicate submissions", async () => {
  await mountPlaceExpenseButton([{ ...record, scheduleId: 2, scheduleItemId: 3 }]);
  mocks.remove.mockReset();
  let reject!: (reason: Error) => void;
  mocks.remove.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  await act(async () => renderer.root.findByType("button").props.onClick({ stopPropagation() {} }));
  const button = renderer.root.findAllByType("button").find(b => b.props["aria-label"]?.endsWith("비용 삭제"));
  expect(button).toBeDefined();
  await act(async () => button!.props.onClick());
  const confirm = renderer.root.findByProps({ "aria-label": "비용 삭제 확인" });
  await act(async () => { confirm.props.onClick(); confirm.props.onClick(); });
  expect(mocks.remove).toHaveBeenCalledTimes(1);
  expect(renderer.root.findByProps({ "aria-label": "비용 삭제 확인" }).props.disabled).toBe(true);
  await act(async () => reject(new Error("네트워크 오류")));
  expect(renderer.root.findByProps({ role: "alert" }).children.join("")).toContain("네트워크 오류");
  expect(renderer.root.findByType(ExpenseScopePanel).findAllByType("li")).toHaveLength(1);
});


it("requires reviewing the refreshed scoped expense before deleting after a conflict", async () => {
  const { ExpenseApiError } = await import("@/lib/api/rooms/expenses");
  const linked = { ...record, scheduleId: 2, scheduleItemId: 3 };
  await mountPlaceExpenseButton([linked]);
  mocks.remove.mockReset();
  mocks.remove.mockRejectedValueOnce(new ExpenseApiError(409, "EXPENSE_CONFLICT", "changed"));
  mocks.list.mockResolvedValue([{ ...linked, version: 3, totalAmount: "200" }]);
  await act(async () => renderer.root.findByType("button").props.onClick({ stopPropagation() {} }));
  const deleteButton = () => renderer.root.findAllByType("button").find(b => b.props["aria-label"]?.endsWith("비용 삭제"))!;
  await act(async () => deleteButton().props.onClick());
  await act(async () => renderer.root.findByProps({ "aria-label": "비용 삭제 확인" }).props.onClick());
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  expect(mocks.remove).toHaveBeenCalledTimes(1);
  expect(renderer.root.findAllByProps({ "aria-label": "비용 삭제 확인" })).toHaveLength(0);
  expect(deleteButton().props["aria-label"]).toContain("200 KRW");
  mocks.remove.mockResolvedValue(undefined);
  mocks.list.mockResolvedValue([]);
  await act(async () => deleteButton().props.onClick());
  await act(async () => renderer.root.findByProps({ "aria-label": "비용 삭제 확인" }).props.onClick());
  expect(mocks.remove).toHaveBeenLastCalledWith("r", 10, 3);
});

it("hides scoped deletion controls when management permission is lost", async () => {
  await mountPlaceExpenseButton([{ ...record, scheduleId: 2, scheduleItemId: 3 }]);
  await act(async () => renderer.root.findByType("button").props.onClick({ stopPropagation() {} }));
  await act(async () => renderer.root.findAllByType("button").find(b => b.props["aria-label"]?.endsWith("비용 삭제"))!.props.onClick());
  await act(async () => {
    client.setQueryData(expenseKeys.members("r"), { members: [] });
    await new Promise(resolve => setTimeout(resolve, 20));
  });
  expect(renderer.root.findAllByProps({ "aria-label": "비용 삭제 확인" })).toHaveLength(0);
  expect(renderer.root.findAllByType("button").filter(b => b.props["aria-label"]?.endsWith("비용 삭제"))).toHaveLength(0);
});

it("emits no expense or budget analytics while pending, after rejected writes, or blocked duplicate writes", async () => {
  await mountMutations();
  let reject!: (error: Error) => void;
  mocks.create.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  let saving!: Promise<void>;
  await act(async () => { saving = context.save(record); });
  expect(analytics.send).not.toHaveBeenCalled();
  await expect(context.save(record)).rejects.toThrow("이전 요청");
  await act(async () => {
    reject(new Error("offline"));
    await expect(saving).rejects.toThrow("offline");
  });
  mocks.patch.mockRejectedValueOnce(new Error("conflict"));
  mocks.remove.mockRejectedValueOnce(new Error("offline"));
  mocks.putBudget.mockRejectedValueOnce(new Error("offline"));
  await act(async () => {
    await expect(context.save(record, record.id, record.version)).rejects.toThrow("conflict");
    await expect(context.remove(record)).rejects.toThrow("offline");
    await expect(context.saveBudget({ budgetKrw: "100", expectedVersion: 0 })).rejects.toThrow("offline");
  });
  expect(analytics.send).not.toHaveBeenCalled();
});

async function startPendingExpenseAndBudgetWrites() {
  await mountMutations();
  let finishExpense!: (expense: Expense) => void;
  let finishBudget!: (budget: unknown) => void;
  mocks.patch.mockImplementationOnce(() => new Promise(resolve => { finishExpense = resolve; }));
  mocks.putBudget.mockImplementationOnce(() => new Promise(resolve => { finishBudget = resolve; }));
  let saving!: Promise<void>;
  let budgeting!: Promise<unknown>;
  await act(async () => {
    saving = context.save(record, record.id, record.version);
    budgeting = context.saveBudget({ budgetKrw: "100", expectedVersion: 0 });
  });
  return async () => {
    finishExpense({ ...record, version: 3 });
    finishBudget({ budgetKrw: "100", currency: "KRW", version: 1 });
    await Promise.all([saving, budgeting]);
  };
}

it.each(["account", "logout", "room", "unmount", "revocation"])("does not attribute late expense and budget success after %s changes", async (change) => {
  const finishWrites = await startPendingExpenseAndBudgetWrites();
  await act(async () => {
    if (change === "unmount") renderer.unmount();
    else if (change === "revocation") getExpenseRecovery(client, "r").revoke();
    else {
      if (change === "account") analytics.userId = 2;
      if (change === "logout") analytics.userId = undefined;
      renderer.update(<QueryClientProvider client={client}>
        <ExpenseProvider roomId={change === "room" ? "next-room" : "r"}><MutationProbe /></ExpenseProvider>
      </QueryClientProvider>);
    }
  });
  await act(async () => {
    await finishWrites();
  });
  expect(analytics.send).not.toHaveBeenCalled();
});

function panelButton(label: string) {
  return renderer.root.findAllByType("button").find(button => button.children.includes(label))!;
}
async function flushQueries() {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
}
it("counts displayed settlement once per opening, never initial reads, rerenders, or refetches", async () => {
  await mountMutations({ panel: true });
  expect(analytics.send).not.toHaveBeenCalled();
  await act(async () => panelButton("정산 요약").props.onClick());
  expect(renderer.root.findByType("dialog")).toBeDefined();
  expect(analytics.send.mock.calls).toEqual([["event", "settlement_summary_viewed", { room_id: "r" }]]);
  await act(async () => { await context.refresh(); });
  await flushQueries();
  expect(analytics.send).toHaveBeenCalledTimes(1);
  await act(async () => panelButton("확인").props.onClick());
  await act(async () => panelButton("정산 요약").props.onClick());
  expect(analytics.send.mock.calls).toEqual([
    ["event", "settlement_summary_viewed", { room_id: "r" }], ["event", "settlement_summary_viewed", { room_id: "r" }],
  ]);
});
it("waits for successful settlement data after loading and error before counting a view", async () => {
  let reject!: (error: Error) => void;
  await mountMutations({ panel: true, summary: () => new Promise((_, fail) => { reject = fail; }) });
  await act(async () => panelButton("정산 요약").props.onClick());
  expect(analytics.send).not.toHaveBeenCalled();
  await act(async () => reject(new Error("offline")));
  await flushQueries();
  expect(JSON.stringify(renderer.toJSON())).toContain("정산 조회에 실패했어요.");
  expect(analytics.send).not.toHaveBeenCalled();
  mocks.summary.mockResolvedValue({ currencies: [] });
  await act(async () => { await context.refresh(); });
  await flushQueries();
  expect(analytics.send.mock.calls).toEqual([["event", "settlement_summary_viewed", { room_id: "r" }]]);
});
it("does not count a settlement that finishes loading after the dialog closes", async () => {
  let finish!: (value: unknown) => void;
  await mountMutations({ panel: true, summary: () => new Promise(resolve => { finish = resolve; }) });
  await act(async () => panelButton("정산 요약").props.onClick());
  await act(async () => panelButton("확인").props.onClick());
  await act(async () => finish({ currencies: [] }));
  await flushQueries();
  expect(analytics.send).not.toHaveBeenCalled();
});


it.each(["account", "logout", "room", "room-loss", "account-roundtrip", "room-roundtrip"])("synchronously fences pending expense and budget analytics on %s before React rerenders", async (change) => {
  const finishWrites = await startPendingExpenseAndBudgetWrites();
  // These are the actual synchronous session mutations. No renderer.update or
  // hook identity change occurs before the in-flight REST writes resolve.
  await act(async () => {
    if (change === "logout") tearDownClientSession({ queryClient: client });
    else if (change.startsWith("account")) {
      const user = { id: 2, email: "", nickname: "", profileImageUrl: null, provider: "GOOGLE", tutorialCompleted: true };
      setSessionUserCache(client, user);
      if (change === "account-roundtrip") setSessionUserCache(client, { ...user, id: 1 });
    } else if (change === "room-loss") useSessionStore.getState().clearCurrentRoomId();
    else {
      useSessionStore.getState().setCurrentRoomId("next-room");
      if (change === "room-roundtrip") useSessionStore.getState().setCurrentRoomId("r");
    }
    await finishWrites();
  });
  expect(analytics.send.mock.calls.filter(([command]) => command === "event")).toEqual([]);
  if (change.endsWith("roundtrip")) {
    mocks.patch.mockResolvedValueOnce({ ...record, version: 4 });
    mocks.putBudget.mockResolvedValueOnce({ budgetKrw: "200", currency: "KRW", version: 2 });
    await act(async () => {
      await context.save(record, record.id, 3);
      await context.saveBudget({ budgetKrw: "200", expectedVersion: 1 });
    });
    expect(analytics.send.mock.calls.filter(([command]) => command === "event")).toEqual([
      ["event", "expense_updated", { room_id: "r" }], ["event", "expense_budget_saved", { room_id: "r" }],
    ]);
  }
});
