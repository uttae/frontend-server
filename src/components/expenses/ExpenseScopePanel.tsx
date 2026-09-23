"use client";

import { ChevronRight, Plus, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";

import { expenseCategoryLabel, type Expense } from "@/lib/api/rooms/expenses";
import {
  expensesInScope,
  totalsByCurrency,
  type ExpenseScope,
} from "@/lib/expenses/expense-scope";

import { formatExpenseAmount } from "./ExpenseViews";

export function ExpenseScopePanel({
  scope,
  expenses,
  isPending,
  isError,
  canManage,
  busy,
  onAdd,
  onEdit,
  onRetry,
  onClose,
}: Readonly<{
  scope: ExpenseScope;
  expenses: readonly Expense[];
  isPending: boolean;
  isError: boolean;
  canManage: boolean;
  busy: boolean;
  onAdd: () => void;
  onEdit: (expense: Expense) => void;
  onRetry: () => void;
  onClose: () => void;
}>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const scoped = expensesInScope(expenses, scope);
  const totals = totalsByCurrency(scoped);

  useEffect(() => {
    const element = dialog.current;
    const opener = element?.ownerDocument.activeElement;
    element?.showModal();
    title.current?.focus();
    return () => {
      element?.close();
      if (opener && opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="fixed inset-y-0 right-0 m-0 ml-auto h-dvh max-h-dvh w-full max-w-none overflow-hidden border-0 bg-white p-0 text-text shadow-2xl backdrop:bg-black/40 sm:inset-y-4 sm:right-4 sm:h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-2rem)] sm:max-w-md sm:rounded-2xl sm:border sm:border-gray-border"
    >
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-gray-border px-5 py-4">
          <div className="min-w-0">
            <h2 ref={title} id={titleId} tabIndex={-1} className="text-title-m mobile:text-title-s font-bold focus:outline-none">
              {scope.label} 비용
            </h2>
            {scope.subtitle ? (
              <p className="mt-1 text-body-s-regular text-dark-gray">{scope.subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="비용 목록 닫기"
            onClick={onClose}
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-dark-gray transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <p className="text-body-s-regular text-dark-gray">총 비용 · {scoped.length}건</p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-title-m mobile:text-title-s font-bold tabular-nums">
            {totals.length ? totals.map(({ currency, amount }) => (
              <span key={currency}>{formatExpenseAmount(amount)} {currency}</span>
            )) : <span>—</span>}
          </div>

          {canManage ? (
            <button
              type="button"
              disabled={busy}
              onClick={onAdd}
              className="mt-5 flex min-h-11 w-full cursor-pointer items-center justify-center gap-1 rounded-lg bg-primary px-4 py-2 text-label-m-emphasis font-semibold text-white transition-colors enabled:hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={16} aria-hidden="true" />
              비용 추가
            </button>
          ) : null}

          <h3 className="mt-6 text-body-s-emphasis font-semibold text-dark-gray">내역</h3>
          {isPending && !scoped.length ? (
            <p role="status" className="py-5 text-body-s-regular text-dark-gray">비용을 불러오는 중…</p>
          ) : isError && !scoped.length ? (
            <div className="space-y-3 py-5 text-body-s-regular text-dark-gray">
              <p role="alert">비용 조회에 실패했어요.</p>
              <button type="button" onClick={onRetry} className="text-primary-strong underline">다시 시도</button>
            </div>
          ) : scoped.length ? (
            <ul className="mt-2 divide-y divide-gray-border">
              {scoped.map((expense) => (
                <li key={expense.id}>
                  <button
                    type="button"
                    disabled={!canManage || busy}
                    aria-label={`${expense.memo || expenseCategoryLabel(expense.category)} ${formatExpenseAmount(expense.totalAmount)} ${expense.currency} 비용 수정`}
                    onClick={() => onEdit(expense)}
                    className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 py-3 text-left text-body-s-regular transition-colors enabled:hover:text-primary-strong focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-default"
                  >
                    <span className="min-w-0 truncate">{expense.memo || expenseCategoryLabel(expense.category)}</span>
                    <span className="flex shrink-0 items-center gap-1 font-medium tabular-nums">
                      {formatExpenseAmount(expense.totalAmount)} {expense.currency}
                      {canManage ? <ChevronRight size={15} aria-hidden="true" /> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-5 text-body-s-regular text-dark-gray">아직 등록된 비용이 없어요.</p>
          )}
        </div>
      </div>
    </dialog>
  );
}
