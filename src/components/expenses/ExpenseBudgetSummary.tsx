"use client";

import { useCallback, useState } from "react";
import type { ExpenseBudget } from "@/lib/api/rooms/expenses";
import { useExpenseContext } from "./ExpenseProvider";
import { ExpenseBudgetModal } from "./ExpenseBudgetModal";
import { expenseButtonClass, formatExpenseAmount } from "./ExpenseViews";

export function ExpenseBudgetSummary() {
  const { budget, krwSummary, canManage, budgetBusy } =
    useExpenseContext();
  const [opened, setOpened] = useState<ExpenseBudget | null>(null);
  const close = useCallback(() => setOpened(null), []);
  const reference = krwSummary.data;
  const amount = budget.data?.budgetKrw;
  const converted = reference?.convertedTotalKrw;
  const hasCompleteTotal =
    reference?.isComplete &&
    reference.missingCurrencies.length === 0 &&
    converted != null;
  return (
    <div className="space-y-4">
      <div className="space-y-2 text-sm">
        <h3 className="text-sm font-medium text-dark-gray">여행 전체 지출</h3>
        {krwSummary.isPending && (
          <p role="status">원화 참고 요약을 불러오는 중…</p>
        )}
        {krwSummary.isError && (
          <p role="alert" className="text-status-negative">
            원화 참고 요약 조회에 실패했어요. 이전 값은 최신 상태가 아닐 수
            있어요. 조회 다시 시도 버튼을 눌러 주세요.
          </p>
        )}
        <p className="break-all text-2xl font-bold tracking-tight tabular-nums">
          {hasCompleteTotal ? `${formatExpenseAmount(converted)} KRW` : "—"}
        </p>
        {reference && (
          <>
            {reference.stale && (
              <p>
                {reference.rateDate
                  ? "환율 갱신에 실패하여 이전 성공 환율을 사용한 참고값이에요."
                  : "성공한 환율 정보가 없어 외화 환산을 확인할 수 없어요."}
              </p>
            )}
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3">
        <div className="min-w-0 max-w-full">
          <h3 className="text-sm font-medium text-dark-gray">여행 전체 예산</h3>
          {budget.isPending && <p role="status">예산을 불러오는 중…</p>}
          {budget.isError && (
            <p role="alert" className="text-sm text-status-negative">
              예산 조회에 실패했어요. 조회 다시 시도 버튼을 눌러 주세요.
            </p>
          )}
          {budget.isSuccess && (
            <p className="break-all text-xl font-bold tabular-nums">
              {amount === null
                ? "미설정"
                : `${formatExpenseAmount(amount!)} KRW`}
            </p>
          )}
        </div>
        {canManage && budget.isSuccess && (
          <button
            type="button"
            className={`${expenseButtonClass} shrink-0`}
            disabled={budgetBusy}
            onClick={() => setOpened(budget.data)}
          >
            {amount === null ? "예산 설정" : "예산 수정"}
          </button>
        )}
      </div>
      {opened && <ExpenseBudgetModal initial={opened} onClose={close} />}
    </div>
  );
}
