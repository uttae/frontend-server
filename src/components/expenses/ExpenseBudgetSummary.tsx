"use client";

import { useCallback, useState } from "react";
import type { ExpenseBudget } from "@/lib/api/rooms/expenses";
import { useExpenseContext } from "./ExpenseProvider";
import { ExpenseBudgetModal } from "./ExpenseBudgetModal";
import { expenseButtonClass, formatExpenseAmount } from "./ExpenseViews";

export function ExpenseBudgetSummary() {
  const { budget, krwSummary, canManage, budgetBusy, syncStatus } =
    useExpenseContext();
  const [opened, setOpened] = useState<ExpenseBudget | null>(null);
  const close = useCallback(() => setOpened(null), []);
  const reference = krwSummary.data;
  const amount = budget.data?.budgetKrw;
  const converted = reference?.convertedTotalKrw;
  const incomplete =
    reference &&
    (!reference.isComplete || reference.missingCurrencies.length > 0);
  const comparable =
    syncStatus === "ready" &&
    budget.isSuccess &&
    krwSummary.isSuccess &&
    amount != null &&
    converted != null &&
    reference?.isComplete &&
    reference.missingCurrencies.length === 0 &&
    !reference.stale;
  const difference = comparable ? BigInt(amount) - BigInt(converted) : null;
  return (
    <div className="space-y-4">
      <div className="space-y-2 text-sm">
        <h3 className="text-sm font-medium text-dark-gray">여행 전체 지출</h3>
        <p className="text-xs text-dark-gray">원화로 환산한 참고 금액이에요.</p>
        {krwSummary.isPending && (
          <p role="status">원화 참고 요약을 불러오는 중…</p>
        )}
        {krwSummary.isError && (
          <p role="alert" className="text-status-negative">
            원화 참고 요약 조회에 실패했어요. 이전 값은 최신 상태가 아닐 수
            있어요. 조회 다시 시도 버튼을 눌러 주세요.
          </p>
        )}
        {reference && (
          <>
            <p className="break-all text-3xl font-bold tracking-tight tabular-nums">
              {converted === null
                ? "환산 금액 없음"
                : `${formatExpenseAmount(converted!)} KRW`}
            </p>
            {incomplete && (
              <p>
                환산 가능한 지출 합계 · 제외 통화:{" "}
                {reference.missingCurrencies.join(", ") || "확인 필요"}
              </p>
            )}
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
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
            className={expenseButtonClass}
            disabled={budgetBusy}
            onClick={() => setOpened(budget.data)}
          >
            {amount === null ? "예산 설정" : "예산 수정"}
          </button>
        )}
      </div>
      {difference !== null ? (
        <div aria-label="예산 비교" className="rounded-xl bg-white p-3">
          <p className="text-sm text-dark-gray">
            {difference < BigInt(0) ? "참고 예산 초과" : "참고 잔여 예산"}
          </p>
          <p className="break-all text-xl font-bold tabular-nums">
            {formatExpenseAmount(
              (difference < BigInt(0) ? -difference : difference).toString(),
            )}{" "}
            KRW
          </p>
        </div>
      ) : (
        <p className="text-xs text-dark-gray">
          예산과 최신 전체 환산 금액이 확인되면 참고 잔여 예산을 비교할 수
          있어요.
        </p>
      )}
      {opened && <ExpenseBudgetModal initial={opened} onClose={close} />}
    </div>
  );
}
