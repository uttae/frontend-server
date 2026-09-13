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
    <div className="mt-4 space-y-4 border-t border-gray-border pt-4">
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
      <div className="space-y-2 text-sm">
        <h3 className="font-semibold">원화 참고 지출</h3>
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
            <p className="break-all text-lg font-bold tabular-nums">
              {converted === null
                ? "환산 금액 없음"
                : `${formatExpenseAmount(converted!)} KRW`}
              {(!reference.isComplete ||
                reference.missingCurrencies.length > 0) &&
                " · 부분 합계"}
            </p>
            {(!reference.isComplete ||
              reference.missingCurrencies.length > 0) && (
              <p>
                일부 통화 제외 합계예요. 제외 통화:{" "}
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
            <p className="text-dark-gray">
              환율 제공일: {reference.rateDate ?? "제공일 없음"}
            </p>
            <p className="text-xs leading-relaxed text-dark-gray">
              출처:{" "}
              <a
                className="underline underline-offset-2"
                href="https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html"
                target="_blank"
                rel="noreferrer"
              >
                European Central Bank (ECB)
              </a>
              . EUR 기준 환율을 원화로 교차 환산한 참고값이며 거래·정산용이
              아닙니다.
            </p>
          </>
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
