"use client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Spinner } from "@/components/ui/spinner";
import { useMobileView } from "@/contexts/MobileViewContext";
import { expenseTitle } from "@/lib/expenses/expense-name";

import { PlusIcon } from "@/assets/icons";
import { Pencil, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

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
  const { isMobileDevice } = useMobileView();
  // 확인창이 닫히면 연 삭제 버튼으로, 그 행이 지워졌거나 버튼이 막혀 있으면 '내역' 제목으로 포커스를 돌린다(옛 동작)
  const deleteOpener = useRef<HTMLButtonElement | null>(null);
  const listHeading = useRef<HTMLHeadingElement>(null);
  const scoped = expensesInScope(expenses, scope);
  const totals = totalsByCurrency(scoped);

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      // 확인창이 열려 있는 동안 Esc·딤은 Base UI가 위 확인창에만 준다
      closeDisabled={disabled}
      // PC는 딤을 눌러도 닫지 않고, 시트는 딤을 눌러 닫는다(지금 동작)
      disablePointerDismissal={!isMobileDevice}
    >
      <ResponsiveDialogContent
        size="md"
        // 시트는 지금처럼 내용 높이, 최대 60dvh. PC는 Dialog 기본 최대 높이
        className={isMobileDevice ? "max-h-[60dvh]" : undefined}
        closeLabel="비용 목록 닫기"
      >
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{scope.label} 비용</ResponsiveDialogTitle>
          {scope.subtitle ? (
            <ResponsiveDialogDescription>{scope.subtitle}</ResponsiveDialogDescription>
          ) : null}
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody>
          <p className="text-body-s-regular text-dark-gray">총 비용 · {scoped.length}건</p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-title-m mobile:text-title-s font-bold tabular-nums">
            {totals.length ? totals.map(({ currency, amount }) => (
              <span key={currency}>{formatExpenseAmount(amount)} {currency}</span>
            )) : <span>—</span>}
          </div>

          {error && <p role="alert" className="mt-3 text-body-s-regular text-status-negative">{error}</p>}
          <h3 ref={listHeading} tabIndex={-1} className="mt-4 text-body-s-emphasis font-semibold text-dark-gray focus:outline-none">내역</h3>
          {isPending && !scoped.length ? (
            <Spinner aria-label="비용 불러오는 중" className="flex w-full py-5" />
          ) : isError && !scoped.length ? (
            <div className="space-y-3 py-5 text-body-s-regular text-dark-gray">
              <p role="alert">비용 조회에 실패했어요.</p>
              <button type="button" onClick={() => { void Promise.resolve(onRetry()).catch(() => setError("비용 조회에 실패했어요. 다시 시도해 주세요.")); }} className="cursor-pointer text-primary-strong underline">다시 시도</button>
            </div>
          ) : scoped.length ? (
            <ul className="mt-2 divide-y divide-gray-border">
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
                        onClick={(event) => { deleteOpener.current = event.currentTarget; setError(""); setSelected(expense); }}
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
        </ResponsiveDialogBody>
        {canManage ? (
          <ResponsiveDialogFooter>
            <Button tone="brand" disabled={disabled} onClick={onAdd}>
              <PlusIcon data-icon="inline-start" />
              비용 추가
            </Button>
          </ResponsiveDialogFooter>
        ) : null}
        {/* 확인창은 목록 대화상자의 React 자식으로 둔다. Base UI가 위 레이어(확인창)에만 Esc·포커스를 준다 */}
        {selected && canManage ? (
          <ExpenseDeleteDialog
            expense={selected}
            pending={disabled}
            onCancel={() => setSelected(null)}
            onConfirm={() => void confirmDelete()}
            finalFocus={() => {
              // Base UI는 닫히는 커밋 도중 이 함수를 불러, 그때는 삭제 버튼의 disabled(deleting)가 아직 풀리지 않았다.
              // 커밋이 끝난 뒤(microtask) DOM을 보고 고르고, false를 돌려 Base UI는 포커스를 옮기지 않게 한다(옛 동작)
              const opener = deleteOpener.current;
              const heading = listHeading.current;
              queueMicrotask(() => {
                if (opener?.isConnected && !opener.matches(":disabled")) opener.focus();
                else heading?.focus();
              });
              return false;
            }}
          />
        ) : null}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}


function ExpenseDeleteDialog({ expense, pending, onCancel, onConfirm, finalFocus }: Readonly<{
  expense: Expense;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  finalFocus: () => boolean;
}>) {
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      closeDisabled={pending}
    >
      {/* 딤을 눌러 닫지 않는다(지금 확인창과 같음). 처음 포커스는 취소 버튼(AlertDialogContent 기본) */}
      <AlertDialogContent
        aria-busy={pending}
        finalFocus={finalFocus}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>비용을 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>삭제한 내역은 복구할 수 없어요.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 px-4 py-3">
          <span className="min-w-0 break-words text-body-s-emphasis">{expenseTitle(expense)}</span>
          <span className="shrink-0 text-body-s-emphasis font-semibold tabular-nums">{formatExpenseAmount(expense.totalAmount)} {expense.currency}</span>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel aria-label="비용 삭제 취소" disabled={pending}>취소</AlertDialogCancel>
          <AlertDialogAction tone="critical" aria-label="비용 삭제 확인" loading={pending} loadingLabel="삭제 중" onClick={onConfirm}>
            비용 삭제
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
