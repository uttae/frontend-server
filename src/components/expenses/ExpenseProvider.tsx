"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRoomMembers } from "@/lib/api/rooms/members";
import {
  createExpense,
  deleteExpense,
  getExpenseCurrencies,
  getExpenses,
  getExpenseSummary,
  getExpenseBudget,
  getExpenseKrwSummary,
  putExpenseBudget,
  type ExpenseBudgetInput,
  type ExpenseBudget,
  patchExpense,
  type Expense,
  type ExpenseInput,
} from "@/lib/api/rooms/expenses";
import { canManageExpenses } from "@/lib/expenses/expense-policy";
import { getExpenseRecoveryStore } from "@/lib/expenses/expense-recovery";
import { expenseKeys } from "@/lib/expenses/expense-queries";
import { useSessionUser } from "@/hooks/useSessionUser";
import { useRoomSchedules } from "@/hooks/useRooms";
import { useExpenseRecovery } from "@/hooks/useExpenseRecovery";
import { ExpenseEditor, type ExpenseEntry } from "./ExpenseEditor";
import { formatExpenseAmount } from "./ExpenseViews";
import { cn } from "@/lib/utils";
import { PLAN_PLACE_CARD_TW } from "@/lib/layout-tokens";

function useExpenses(roomId: string) {
  const client = useQueryClient();
  const { data: user } = useSessionUser();
  const { recovery, revoked, syncStatus } = useExpenseRecovery(
    roomId,
    Boolean(roomId && user),
  );
  const enabled = Boolean(roomId && user) && !revoked;
  // A complete successful GET is required before declaring an ID unknown.
  // The shared presence cache may contain only a partial STOMP member snapshot.
  const memberQuery = useQuery({
    queryKey: expenseKeys.members(roomId),
    queryFn: () => getRoomMembers(roomId),
    enabled,
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const members = memberQuery.data?.members ?? [];
  const canManage =
    !revoked && canManageExpenses(user?.id, members, memberQuery.status);
  const schedules = useRoomSchedules(revoked ? null : roomId || null);
  // Recovery owns focus/reconnect reads; manual refresh remains available.
  const options = {
    enabled,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  };
  const list = useQuery({
    ...options,
    queryKey: expenseKeys.list(roomId),
    queryFn: () => getExpenses(roomId),
  });
  const summary = useQuery({
    ...options,
    queryKey: expenseKeys.summary(roomId),
    queryFn: () => getExpenseSummary(roomId),
  });
  const budget = useQuery({
    ...options,
    queryKey: expenseKeys.budget(roomId),
    queryFn: () => getExpenseBudget(roomId),
  });
  const krwSummary = useQuery({
    ...options,
    queryKey: expenseKeys.krwSummary(roomId),
    queryFn: () => getExpenseKrwSummary(roomId),
  });
  const budgetMutation = useMutation({
    mutationFn: (body: ExpenseBudgetInput) => {
      if (!canManage || recovery.getSnapshot() === "revoked")
        throw new Error(
          "현재 참여 중인 방장과 멤버만 예산을 변경할 수 있어요.",
        );
      return putExpenseBudget(roomId, body);
    },
    retry: false,
    onError: recovery.handleError,
    onSuccess: async (record) => {
      if (recovery.getSnapshot() === "revoked") return;
      const current = client.getQueryData<ExpenseBudget>(
        expenseKeys.budget(roomId),
      );
      if (current && current.version > record.version) {
        await recovery.refresh("budget").catch(() => {});
        return;
      }
      await client.cancelQueries({
        queryKey: expenseKeys.budget(roomId),
        exact: true,
      });
      if (recovery.getSnapshot() === "revoked") return;
      client.setQueryData<ExpenseBudget>(
        expenseKeys.budget(roomId),
        (previous) =>
          previous && previous.version > record.version ? previous : record,
      );
    },
  });
  const budgetLock = useRef(false);
  async function saveBudget(body: ExpenseBudgetInput) {
    if (budgetLock.current) throw new Error("이전 요청을 처리하고 있어요.");
    budgetLock.current = true;
    try {
      return await budgetMutation.mutateAsync(body);
    } finally {
      budgetLock.current = false;
    }
  }
  const currencies = useQuery({
    ...options,
    queryKey: expenseKeys.currencies(roomId),
    queryFn: () => getExpenseCurrencies(roomId),
  });
  const mutation = useMutation({
    mutationFn: async (
      op:
        | { body: ExpenseInput; id?: number; expectedVersion?: number }
        | { deleteId: number; expectedVersion: number },
    ) => {
      if (!canManage || recovery.getSnapshot() === "revoked")
        throw new Error(
          "현재 참여 중인 방장과 멤버만 비용을 변경할 수 있어요.",
        );
      if ("deleteId" in op)
        return deleteExpense(roomId, op.deleteId, op.expectedVersion);
      if (op.id === undefined) return createExpense(roomId, op.body);
      if (op.expectedVersion === undefined)
        throw new Error("수정할 비용을 다시 열어 주세요.");
      return patchExpense(roomId, op.id, {
        ...op.body,
        expectedVersion: op.expectedVersion,
      });
    },
    retry: false,
    onMutate: () => recovery.listRevision,
    onError: recovery.handleError,
    onSuccess: async (record, op, revision) => {
      if (recovery.getSnapshot() === "revoked") return;
      const previous = client.getQueryData<Expense[]>(expenseKeys.list(roomId));
      const existing =
        record && previous?.find((item) => item.id === record.id);
      if (
        (existing && record && existing.version > record.version) ||
        (!existing && revision !== recovery.listRevision)
      ) {
        await recovery.refresh("expenses").catch(() => {});
        return;
      }
      // Cancel earlier reads before installing the committed REST result.
      await client.cancelQueries({
        queryKey: expenseKeys.list(roomId),
        exact: true,
      });
      if (recovery.getSnapshot() === "revoked") return;
      client.setQueryData<Expense[]>(
        expenseKeys.list(roomId),
        (previous = []) => {
          if ("deleteId" in op)
            return previous.filter((e) => e.id !== op.deleteId);
          if (!record) return previous;
          const existing = previous.find((item) => item.id === record.id);
          if (existing && existing.version > record.version) return previous;
          return [...previous.filter((e) => e.id !== record.id), record].sort(
            (a, b) => a.id - b.id,
          );
        },
      );
      // The write committed; failed follow-up reads are shown by syncStatus.
      await recovery.refresh("expenses").catch(() => {});
    },
  });
  const lock = useRef(false);
  async function run(op: Parameters<typeof mutation.mutateAsync>[0]) {
    if (lock.current) throw new Error("이전 요청을 처리하고 있어요.");
    lock.current = true;
    try {
      await mutation.mutateAsync(op);
    } finally {
      lock.current = false;
    }
  }
  const reads = [list, summary, budget, krwSummary, currencies, memberQuery];
  let resolvedSyncStatus = syncStatus;
  if (syncStatus === "ready") {
    if (reads.some(query => query.isError)) resolvedSyncStatus = "error";
    else if (reads.some(query => !query.isSuccess || query.isFetching)) resolvedSyncStatus = "pending";
  }
  return {
    roomId,
    revoked,
    syncStatus: resolvedSyncStatus,
    members,
    memberStatus: memberQuery.status,
    currentUserId: user?.id,
    canManage,
    schedules: schedules.data ?? [],
    schedulesReady: schedules.isSuccess,
    list,
    summary,
    currencies,
    budget,
    krwSummary,
    saveBudget,
    budgetBusy: budgetMutation.isPending,
    readLatestBudget: async () => {
      if (recovery.getSnapshot() === "revoked")
        throw new Error("방 접근 권한이 없어요.");
      await client.cancelQueries({
        queryKey: expenseKeys.budget(roomId),
        exact: true,
      });
      if (recovery.getSnapshot() === "revoked")
        throw new Error("방 접근 권한이 없어요.");
      return client.fetchQuery({
        queryKey: expenseKeys.budget(roomId),
        queryFn: () => getExpenseBudget(roomId),
        staleTime: 0,
        retry: false,
      });
    },
    busy: mutation.isPending,
    save: (body: ExpenseInput, id?: number, expectedVersion?: number) =>
      run({ body, id, expectedVersion }),
    remove: (expense: Expense) =>
      run({ deleteId: expense.id, expectedVersion: expense.version }),
    readLatest: async (id: number) => {
      if (recovery.getSnapshot() === "revoked")
        throw new Error("방 접근 권한이 없어요.");
      await client.cancelQueries({
        queryKey: expenseKeys.list(roomId),
        exact: true,
      });
      if (recovery.getSnapshot() === "revoked")
        throw new Error("방 접근 권한이 없어요.");
      const records = await client.fetchQuery({
        queryKey: expenseKeys.list(roomId),
        queryFn: () => getExpenses(roomId),
        staleTime: 0,
        retry: false,
      });
      return records.find((record) => record.id === id);
    },
    refresh: () =>
      recovery.getSnapshot() === "revoked"
        ? Promise.resolve([])
        : Promise.all([
            recovery.refresh("all"),
            schedules.refetch(),
          ]),
  };
}
type ExpenseContextValue = ReturnType<typeof useExpenses> & {
  open: (entry: ExpenseEntry) => void;
};
const ExpenseContext = createContext<ExpenseContextValue | null>(null);
export function useExpenseContext() {
  const value = useContext(ExpenseContext);
  if (!value) throw new Error("ExpenseProvider가 필요해요.");
  return value;
}
function ExpenseProviderLifetime({
  roomId,
  children,
}: Readonly<{
  roomId: string;
  children: ReactNode;
}>) {
  const state = useExpenses(roomId);
  const [entry, setEntry] = useState<ExpenseEntry | null>(null);
  return (
    <ExpenseContext.Provider value={{ ...state, open: setEntry }}>
      {children}
      {!state.revoked && entry && (
        <ExpenseEditor initial={entry} onClose={() => setEntry(null)} />
      )}
    </ExpenseContext.Provider>
  );
}
export function ExpenseProvider(props: Readonly<{ roomId: string; children: ReactNode }>) {
  const client = useQueryClient();
  const store = getExpenseRecoveryStore(client, props.roomId);
  const recovery = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  return <ExpenseProviderLifetime key={recovery.generation} {...props} />;
}
export function ExpenseEntryButton({
  scheduleId,
  scheduleItemId,
  label = "비용 추가",
  className = "min-h-10 rounded-xl px-3 py-2 text-label-m-emphasis mobile:text-label-s-emphasis font-semibold text-primary-strong cursor-pointer transition-colors enabled:hover:bg-primary/10",
  icon = "+ ",
}: Readonly<{
  scheduleId?: number;
  scheduleItemId?: number;
  label?: string;
  className?: string;
  icon?: ReactNode;
}>) {
  const context = useContext(ExpenseContext);
  if (!context?.canManage) return null;
  const latest = scheduleItemId === undefined ? undefined : context.list.data
    ?.filter((expense) => expense.scheduleId === scheduleId && expense.scheduleItemId === scheduleItemId)
    .reduce<Expense | undefined>((selected, expense) => {
      if (!selected) return expense;
      const difference = (Date.parse(expense.createdAt) || 0) - (Date.parse(selected.createdAt) || 0);
      return difference > 0 || (difference === 0 && expense.id > selected.id) ? expense : selected;
    }, undefined);
  const amountLabel = latest ? `${formatExpenseAmount(latest.totalAmount)} ${latest.currency}` : null;
  return (
    <button
      type="button"
      data-plan-card-no-drag
      disabled={context.busy || (scheduleItemId !== undefined && !context.list.isSuccess)}
      aria-label={amountLabel ? `${amountLabel} 비용 수정` : undefined}
      aria-haspopup="dialog"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        context.open(latest ? { expense: latest } : { scheduleId, scheduleItemId });
      }}
      className={cn(className, latest && PLAN_PLACE_CARD_TW.triggerButtonActive, "disabled:cursor-not-allowed disabled:opacity-50")}
    >
      {latest && typeof icon === "string" ? null : icon}{amountLabel ?? label}
    </button>
  );
}
