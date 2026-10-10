"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { readSessionUserId } from "@/lib/session-user-cache";
import { sessionUserQueryKey } from "@/lib/query-keys";
import { useSessionStore } from "@/stores/session-store";
import { AnalyticsEvents, trackAnalyticsEvent } from "@/lib/analytics/track";
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
  type ExpenseKrwFilters,
} from "@/lib/api/rooms/expenses";
import { canManageExpenses } from "@/lib/expenses/expense-policy";
import { getExpenseRecoveryStore } from "@/lib/expenses/expense-recovery";
import { expenseKeys } from "@/lib/expenses/expense-queries";
import { expensesInScope, totalsByCurrency, type ExpenseScope } from "@/lib/expenses/expense-scope";
import { useSessionUser } from "@/hooks/useSessionUser";
import { useRoomSchedules } from "@/hooks/useRooms";
import { useExpenseRecovery } from "@/hooks/useExpenseRecovery";
import { ExpenseEditor, type ExpenseEntry } from "./ExpenseEditor";
import { ExpenseScopePanel } from "./ExpenseScopePanel";
import { formatExpenseAmount } from "./ExpenseViews";
import { cn } from "@/lib/utils";
import { PLAN_PLACE_CARD_TW } from "@/lib/layout-tokens";

function useExpenses(roomId: string) {
  const client = useQueryClient();
  const { data: user } = useSessionUser();
  const sessionReady = useSessionStore((session) => session.sessionReady);
  const currentRoomId = useSessionStore((session) => session.currentRoomId);
  // A late response must never be attributed to the next account or room.
  const analyticsScope = useRef<{ active: boolean } | null>(null);
  const analyticsMounted = useRef(false);
  useLayoutEffect(() => {
    analyticsMounted.current = true;
    const session = useSessionStore.getState();
    const scope = {
      active: session.sessionReady && session.currentRoomId === roomId &&
        user?.id !== undefined && readSessionUserId(client) === user.id,
    };
    analyticsScope.current = scope;
    // Session teardown and account/room changes happen before React rerenders.
    // Invalidate captured tokens permanently, including tokens from new writes.
    const invalidate = () => {
      if (analyticsScope.current) analyticsScope.current.active = false;
    };
    const unsubscribeSession = useSessionStore.subscribe((next) => {
      if (!next.sessionReady || next.currentRoomId !== roomId) invalidate();
    });
    const unsubscribeQuery = client.getQueryCache().subscribe((event) => {
      if (JSON.stringify(event.query.queryKey) !== JSON.stringify(sessionUserQueryKey)) return;
      if (event.type === "removed" || readSessionUserId(client) !== user?.id)
        invalidate();
    });
    return () => {
      analyticsMounted.current = false;
      invalidate();
      unsubscribeSession();
      unsubscribeQuery();
    };
  }, [client, roomId, user?.id, sessionReady, currentRoomId]);
  function captureAnalyticsScope() {
    const session = useSessionStore.getState();
    if (!analyticsMounted.current || !session.sessionReady ||
      session.currentRoomId !== roomId || user?.id === undefined ||
      readSessionUserId(client) !== user.id) return null;
    // A batched roundtrip can leave React dependencies unchanged. New writes
    // get a fresh token; pending writes retain their permanently invalid token.
    if (!analyticsScope.current?.active) analyticsScope.current = { active: true };
    return analyticsScope.current;
  }
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
    // Visibility recovery already refreshes members with the other room data.
    refetchOnWindowFocus: false,
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
  const [krwFilters, setKrwFilters] = useState<ExpenseKrwFilters>({});
  const filteredKrwSummary = useQuery({
    ...options,
    // The unfiltered view already has krwSummary; do not mount another observer
    // onto that stale query when returning to All and trigger a whole-room refetch.
    enabled: enabled && Object.keys(krwFilters).length > 0,
    queryKey: [...expenseKeys.krwSummary(roomId), krwFilters],
    queryFn: () => getExpenseKrwSummary(roomId, krwFilters),
  });
  const budgetMutation = useMutation({
    mutationFn: async (body: ExpenseBudgetInput) => {
      if (!canManage || recovery.getSnapshot() === "revoked")
        throw new Error(
          "현재 참여 중인 방장과 멤버만 예산을 변경할 수 있어요.",
        );
      const scope = captureAnalyticsScope();
      const record = await putExpenseBudget(roomId, body);
      if (scope?.active && recovery.getSnapshot() !== "revoked")
        trackAnalyticsEvent(AnalyticsEvents.expenseBudgetSaved);
      return record;
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
      const scope = captureAnalyticsScope();
      let record: Expense | void;
      let event:
        | typeof AnalyticsEvents.expenseCreated
        | typeof AnalyticsEvents.expenseUpdated
        | typeof AnalyticsEvents.expenseDeleted;
      if ("deleteId" in op) {
        record = await deleteExpense(roomId, op.deleteId, op.expectedVersion);
        event = AnalyticsEvents.expenseDeleted;
      } else if (op.id === undefined) {
        record = await createExpense(roomId, op.body);
        event = AnalyticsEvents.expenseCreated;
      } else {
        if (op.expectedVersion === undefined)
          throw new Error("수정할 비용을 다시 열어 주세요.");
        record = await patchExpense(roomId, op.id, {
          ...op.body,
          expectedVersion: op.expectedVersion,
        });
        event = AnalyticsEvents.expenseUpdated;
      }
      // Count the committed write before cache reconciliation or recovery reads.
      if (scope?.active && recovery.getSnapshot() !== "revoked")
        trackAnalyticsEvent(event);
      return record;
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
  // A filter request updates only the selected list, not whole-trip synchronization.
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
    filteredKrwSummary,
    krwFilters,
    setKrwFilters,
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
  openScope: (scope: ExpenseScope) => void;
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
  const [scope, setScope] = useState<ExpenseScope | null>(null);
  return (
    <ExpenseContext.Provider value={{ ...state, open: setEntry, openScope: setScope }}>
      {children}
      {!state.revoked && scope && (
        <ExpenseScopePanel
          scope={scope}
          roomId={state.roomId}
          expenses={state.list.data ?? []}
          isPending={state.list.isPending}
          isError={state.list.isError}
          canManage={state.canManage}
          busy={state.busy}
          onAdd={() => setEntry(scope.scheduleItemId === undefined
            ? { scheduleId: scope.scheduleId }
            : { scheduleId: scope.scheduleId, scheduleItemId: scope.scheduleItemId })}
          onEdit={(expense) => setEntry({ expense })}
          onRetry={() => void state.list.refetch()}
          onClose={() => setScope(null)}
        />
      )}
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
  scopeLabel = scheduleItemId === undefined ? "일차" : "장소",
  scopeSubtitle,
  label = "비용 추가",
  className = "min-h-10 rounded-xl px-3 py-2 text-label-m-emphasis mobile:text-label-s-emphasis font-semibold text-primary-strong cursor-pointer transition-colors enabled:hover:bg-primary/10",
  icon = "+ ",
}: Readonly<{
  scheduleId: number;
  scheduleItemId?: number;
  scopeLabel?: string;
  scopeSubtitle?: string;
  label?: string;
  className?: string;
  icon?: ReactNode;
}>) {
  const context = useContext(ExpenseContext);
  if (!context?.canManage) return null;
  const scope = { scheduleId, scheduleItemId, label: scopeLabel, subtitle: scopeSubtitle };
  const scoped = expensesInScope(context.list.data ?? [], scope);
  const totals = totalsByCurrency(scoped);
  const summaryLabel = !context.list.isSuccess
    ? "비용 보기"
    : scoped.length
      ? `비용 ${scoped.length}건 · ${totals.map(({ currency, amount }) => `${formatExpenseAmount(amount)} ${currency}`).join(" · ")}`
      : label;
  return (
    <button
      type="button"
      data-plan-card-no-drag
      disabled={context.busy}
      aria-label={`${scopeLabel} ${context.list.isSuccess && !scoped.length ? "비용 추가" : "비용 목록 열기"}`}
      aria-haspopup="dialog"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        if (context.list.isSuccess && !scoped.length) {
          context.open(scheduleItemId === undefined
            ? { scheduleId }
            : { scheduleId, scheduleItemId });
        } else {
          context.openScope(scope);
        }
      }}
      className={cn(className, "min-w-0 max-w-full whitespace-normal break-words text-left", scoped.length > 0 && PLAN_PLACE_CARD_TW.triggerButtonActive, "disabled:cursor-not-allowed disabled:opacity-50")}
    >
      {icon}{summaryLabel}
    </button>
  );
}
