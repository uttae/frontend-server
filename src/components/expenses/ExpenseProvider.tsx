"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
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
  patchExpense,
  type Expense,
  type ExpenseInput,
} from "@/lib/api/rooms/expenses";
import { canManageExpenses } from "@/lib/expenses/expense-policy";
import {
  expenseKeys,
  invalidateExpenses,
} from "@/lib/expenses/expense-queries";
import { useSessionUser } from "@/hooks/useSessionUser";
import { useRoomSchedules } from "@/hooks/useRooms";
import { ExpenseEditor, type ExpenseEntry } from "./ExpenseEditor";

function useExpenses(roomId: string) {
  const client = useQueryClient();
  const { data: user } = useSessionUser();
  const enabled = Boolean(roomId && user);
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
  const canManage = canManageExpenses(user?.id, members, memberQuery.status);
  const schedules = useRoomSchedules(roomId || null);
  // No expense-specific realtime event exists. Refresh on focus/reconnect and on demand.
  const options = {
    enabled,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
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
  const currencies = useQuery({
    ...options,
    queryKey: expenseKeys.currencies(roomId),
    queryFn: () => getExpenseCurrencies(roomId),
  });
  const mutation = useMutation({
    mutationFn: async (
      op: { body: ExpenseInput; id?: number } | { deleteId: number },
    ) => {
      if (!canManage)
        throw new Error(
          "현재 참여 중인 방장과 멤버만 지출을 변경할 수 있어요.",
        );
      if ("deleteId" in op) return deleteExpense(roomId, op.deleteId);
      return op.id === undefined
        ? createExpense(roomId, op.body)
        : patchExpense(roomId, op.id, op.body);
    },
    onSuccess: () => invalidateExpenses(client, roomId),
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
  return {
    roomId,
    members,
    memberStatus: memberQuery.status,
    currentUserId: user?.id,
    canManage,
    schedules: schedules.data ?? [],
    schedulesReady: schedules.isSuccess,
    list,
    summary,
    currencies,
    busy: mutation.isPending,
    save: (body: ExpenseInput, id?: number) => run({ body, id }),
    remove: (expense: Expense) => run({ deleteId: expense.id }),
    refresh: () =>
      Promise.all([invalidateExpenses(client, roomId), schedules.refetch()]),
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
export function ExpenseProvider({
  roomId,
  children,
}: {
  roomId: string;
  children: ReactNode;
}) {
  const state = useExpenses(roomId);
  const [entry, setEntry] = useState<ExpenseEntry | null>(null);
  return (
    <ExpenseContext.Provider value={{ ...state, open: setEntry }}>
      {children}
      {entry && (
        <ExpenseEditor initial={entry} onClose={() => setEntry(null)} />
      )}
    </ExpenseContext.Provider>
  );
}
export function ExpenseEntryButton({
  scheduleId,
  scheduleItemId,
  label = "지출 추가",
}: {
  scheduleId?: number;
  scheduleItemId?: number;
  label?: string;
}) {
  const context = useContext(ExpenseContext);
  if (!context?.canManage) return null;
  return (
    <button
      type="button"
      data-plan-card-no-drag
      disabled={context.busy}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        context.open({ scheduleId, scheduleItemId });
      }}
      className="min-h-10 rounded-xl px-3 py-2 text-sm font-semibold text-primary-strong cursor-pointer transition-colors enabled:hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      + {label}
    </button>
  );
}
