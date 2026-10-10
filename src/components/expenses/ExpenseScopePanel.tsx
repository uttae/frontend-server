"use client";
import { LoadingIndicator } from "@/components/loading/LoadingIndicator";
import { useSheetDrag } from "@/components/mobile/useSheetDrag";
import { BottomSheetDragHandle } from "@/components/mobile/BottomSheetDragHandle";
import { expenseTitle } from "@/lib/expenses/expense-name";

import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { ExpenseApiError, type Expense } from "@/lib/api/rooms/expenses";
import {
  expensesInScope,
  totalsByCurrency,
  type ExpenseScope,
} from "@/lib/expenses/expense-scope";

import { formatExpenseAmount } from "./ExpenseViews";
import { ExpensePlaceLabel } from "./ExpensePlaceLabel";

export function ExpenseScopePanel({
  scope,
  roomId,
  expenses,
  isPending,
  isError,
  canManage,
  busy,
  onAdd,
  onEdit,
  onDelete,
  onRetry,
  onClose,
}: Readonly<{
  scope: ExpenseScope;
  roomId: string;
  expenses: readonly Expense[];
  isPending: boolean;
  isError: boolean;
  canManage: boolean;
  busy: boolean;
  onAdd: () => void;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => Promise<void>;
  onRetry: () => void | Promise<unknown>;
  onClose: () => void;
}>) {
  const [selected, setSelected] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const deleteLock = useRef(false);
  const disabled = busy || deleting;
  const confirming = selected !== null && canManage;
  async function confirmDelete() {
    if (!selected || !canManage || busy || deleteLock.current) return;
    deleteLock.current = true;
    setDeleting(true);
    setError("");
    try {
      await onDelete(selected);
    } catch (error) {
      if (error instanceof ExpenseApiError &&
          (error.code === "EXPENSE_CONFLICT" || error.code === "EXPENSE_NOT_FOUND")) {
        try {
          await onRetry();
          setError("비용이 변경되었거나 삭제되었어요. 최신 내역을 확인한 뒤 다시 선택해 주세요.");
        } catch {
          setError("최신 비용 조회에 실패했어요. 다시 시도해 주세요.");
        }
      } else {
        setError(error instanceof Error ? error.message : "비용 삭제에 실패했어요.");
      }
    } finally {
      setSelected(null);
      setDeleting(false);
      deleteLock.current = false;
    }
  }
  const sheetDrag = useSheetDrag(onClose, disabled || confirming);
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
      style={sheetDrag.surfaceStyle}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!disabled && !confirming) onClose();
      }}
      className="fixed inset-auto left-1/2 top-1/2 m-0 max-h-[85dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-gray-border bg-white p-0 text-text shadow-2xl backdrop:bg-black/40 mobile:bottom-0 mobile:left-0 mobile:max-h-[60dvh] mobile:top-auto mobile:w-full mobile:max-w-none mobile:translate-x-0 mobile:translate-y-0 mobile:rounded-b-none mobile:rounded-t-[20px] mobile:animate-in mobile:slide-in-from-bottom mobile:duration-200 mobile:border-x-0 mobile:border-b-0 max-sm:bottom-0 max-sm:left-0 max-sm:top-auto max-sm:w-full max-sm:max-w-none max-sm:max-h-[60dvh] max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-[20px] max-sm:border-x-0 max-sm:border-b-0"
    >
      <div className="flex max-h-[85dvh] min-h-0 flex-col mobile:max-h-[60dvh] max-sm:max-h-[60dvh]">
        <BottomSheetDragHandle drag={sheetDrag} className="max-sm:pt-5 mobile:pt-5">
        <div aria-hidden className="mx-auto hidden h-1 w-9 shrink-0 rounded-full bg-border max-sm:block mobile:block" />
        <header className="flex items-start justify-between gap-3 border-b border-gray-border px-5 py-3">
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
            disabled={disabled}
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-dark-gray transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        </BottomSheetDragHandle>

        <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
          <p className="text-body-s-regular text-dark-gray">총 비용 · {scoped.length}건</p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-title-m mobile:text-title-s font-bold tabular-nums">
            {totals.length ? totals.map(({ currency, amount }) => (
              <span key={currency}>{formatExpenseAmount(amount)} {currency}</span>
            )) : <span>—</span>}
          </div>

          {error && <p role="alert" className="mt-3 text-body-s-regular text-status-negative">{error}</p>}
          <h3 className="mt-4 text-body-s-emphasis font-semibold text-dark-gray">내역</h3>
          {isPending && !scoped.length ? (
            <LoadingIndicator label="비용 불러오는 중" className="flex w-full py-5" />
          ) : isError && !scoped.length ? (
            <div className="space-y-3 py-5 text-body-s-regular text-dark-gray">
              <p role="alert">비용 조회에 실패했어요.</p>
              <button type="button" onClick={() => { void Promise.resolve(onRetry()).catch(() => setError("비용 조회에 실패했어요. 다시 시도해 주세요.")); }} className="cursor-pointer text-primary-strong underline">다시 시도</button>
            </div>
          ) : scoped.length ? (
            <ul className="mt-2 -mr-5 min-h-0 overflow-y-auto overscroll-contain pr-5 divide-y divide-gray-border [scrollbar-color:rgba(0,0,0,0.2)_transparent]">
              {scoped.map((expense) => (
                <li key={expense.id} className="flex items-center gap-2 py-2">
                  <div className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 px-2 py-2 text-body-s-regular">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate">{expenseTitle(expense)}</span>
                      {expense.memo && <span className="truncate text-body-xs-regular text-dark-gray">{expense.memo}</span>}
                      {expense.scheduleId !== null && expense.scheduleItemId !== null ? (
                        <ExpensePlaceLabel
                          roomId={roomId}
                          scheduleId={expense.scheduleId}
                          itemId={expense.scheduleItemId}
                        />
                      ) : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 font-medium tabular-nums">
                      {formatExpenseAmount(expense.totalAmount)} {expense.currency}
                    </span>
                  </div>
                  {canManage ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label={`${expenseTitle(expense)} ${formatExpenseAmount(expense.totalAmount)} ${expense.currency} 비용 수정`}
                        title="비용 수정"
                        disabled={disabled}
                        onClick={() => onEdit(expense)}
                        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-dark-gray transition-colors enabled:hover:bg-gray-50 enabled:hover:text-text focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Pencil size={18} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`${expenseTitle(expense)} ${formatExpenseAmount(expense.totalAmount)} ${expense.currency} 비용 삭제`}
                        title="비용 삭제"
                        disabled={disabled}
                        onClick={() => { setError(""); setSelected(expense); }}
                        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-dark-gray transition-colors enabled:hover:bg-gray-50 enabled:hover:text-text focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 size={18} aria-hidden="true" />
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-5 text-body-s-regular text-dark-gray">아직 등록된 비용이 없어요.</p>
          )}
        </div>
        {canManage ? (
          <footer className="shrink-0 border-t border-gray-border px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              disabled={disabled}
              onClick={onAdd}
              className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-1 rounded-lg bg-primary px-4 py-2 text-label-m-emphasis font-semibold text-white transition-colors enabled:hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={16} aria-hidden="true" />
              비용 추가
            </button>
          </footer>
        ) : null}
      </div>
      {selected && canManage ? (
        <ExpenseDeleteDialog
          expense={selected}
          pending={disabled}
          onCancel={() => setSelected(null)}
          onConfirm={() => void confirmDelete()}
          fallbackFocus={title}
        />
      ) : null}
    </dialog>
  );
}


function ExpenseDeleteDialog({ expense, pending, onCancel, onConfirm, fallbackFocus }: Readonly<{
  expense: Expense;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  fallbackFocus: { current: HTMLHeadingElement | null };
}>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const element = dialog.current;
    const trigger = element?.ownerDocument.activeElement;
    const fallback = fallbackFocus.current;
    element?.showModal();
    cancel.current?.focus();
    return () => {
      element?.close();
      // Wait for the parent to re-enable its controls or remove the deleted row.
      queueMicrotask(() => {
        if (trigger && trigger instanceof HTMLElement && trigger.isConnected && !trigger.matches(":disabled")) {
          trigger.focus();
        } else if (fallback?.isConnected) {
          fallback.focus();
        }
      });
    };
  }, [fallbackFocus]);

  return (
    <dialog
      ref={dialog}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={pending}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!pending) onCancel();
      }}
      className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-2xl border border-gray-border bg-white p-5 text-text shadow-2xl backdrop:bg-black/30"
    >
      <h2 id={titleId} className="text-title-s font-bold">비용을 삭제할까요?</h2>
      <p id={descriptionId} className="mt-2 text-body-s-regular text-dark-gray">삭제한 내역은 복구할 수 없어요.</p>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 px-4 py-3">
        <span className="min-w-0 break-words text-body-s-emphasis">{expenseTitle(expense)}</span>
        <span className="shrink-0 text-body-s-emphasis font-semibold tabular-nums">{formatExpenseAmount(expense.totalAmount)} {expense.currency}</span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button ref={cancel} type="button" aria-label="비용 삭제 취소" disabled={pending} onClick={onCancel} className="min-h-11 cursor-pointer rounded-lg border border-gray-border px-4 text-body-s-emphasis transition-colors enabled:hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">취소</button>
        <button type="button" aria-label="비용 삭제 확인" disabled={pending} onClick={onConfirm} className="min-h-11 cursor-pointer rounded-lg bg-status-negative px-4 text-body-s-emphasis text-white transition-colors enabled:hover:brightness-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-status-negative disabled:cursor-not-allowed disabled:opacity-50">{pending ? "삭제 중…" : "비용 삭제"}</button>
      </div>
    </dialog>
  );
}
