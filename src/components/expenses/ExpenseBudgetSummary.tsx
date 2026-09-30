"use client";

import { useCallback, useState } from "react";
import type { ExpenseBudget } from "@/lib/api/rooms/expenses";
import { useExpenseContext } from "./ExpenseProvider";
import { ExpenseBudgetModal } from "./ExpenseBudgetModal";
import { WriteIcon } from "@/assets/icons";
import { remainingBudget } from "@/lib/expenses/ledger-display";
import { formatExpenseAmount } from "./ExpenseViews";

export function ExpenseBudgetSummary() {
  const { budget, krwSummary, canManage, budgetBusy, syncStatus } =
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
      <div className="space-y-2 text-body-s-regular mobile:text-body-xs-regular">
        <h3 className="text-body-s-emphasis mobile:text-body-xs-emphasis font-medium text-dark-gray">
          여행 전체 비용
        </h3>
        {krwSummary.isPending && (
          <output style={{ display: "block" }}>
            원화 참고 요약을 불러오는 중…
          </output>
        )}
        {krwSummary.isError && (
          <p role="alert" className="text-status-negative">
            원화 참고 요약 조회에 실패했어요. 이전 값은 최신 상태가 아닐 수
            있어요. 조회 다시 시도 버튼을 눌러 주세요.
          </p>
        )}
        <p className="break-all text-heading-s mobile:text-heading-m font-bold text-primary tracking-tight tabular-nums">
          {hasCompleteTotal ? `${formatExpenseAmount(converted)}원` : "—"}
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
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white">
        <div className="flex min-w-0 max-w-full flex-1 flex-wrap items-center justify-between gap-2">
          <h3 className="text-body-s-emphasis mobile:text-body-xs-emphasis font-medium text-dark-gray">
            여행 전체 예산
          </h3>
          {budget.isPending && (
            <output style={{ display: "block" }}>예산을 불러오는 중…</output>
          )}
          {budget.isError && (
            <p
              role="alert"
              className="text-body-s-regular mobile:text-body-xs-regular text-status-negative"
            >
              예산 조회에 실패했어요. 조회 다시 시도 버튼을 눌러 주세요.
            </p>
          )}
          {budget.isSuccess && (
            <p className="break-all text-body-s-emphasis font-bold tabular-nums">
              {amount === null ? "미설정" : `${formatExpenseAmount(amount!)}원`}
            </p>
          )}
        </div>
        {canManage && budget.isSuccess && (
          <button
            type="button"
            aria-label={amount === null ? "예산 설정" : "예산 수정"}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-text-subtle hover:bg-fill focus-visible:outline-2 focus-visible:outline-primary"
            disabled={budgetBusy}
            onClick={() => setOpened(budget.data)}
          >
            <WriteIcon size={16} />
          </button>
        )}
      </div>
      <div
        aria-label="남은 예산"
        className="flex items-center justify-between gap-2 text-body-s-regular text-primary"
      >
        <span>남은 예산</span>
        <p className="break-all text-right font-bold tabular-nums">
          {syncStatus === "ready" &&
          budget.isSuccess &&
          !budget.isError &&
          krwSummary.isSuccess &&
          !krwSummary.isError &&
          hasCompleteTotal &&
          !reference?.stale &&
          amount != null
            ? `${formatExpenseAmount(remainingBudget(amount, converted))}원`
            : "—"}
        </p>
      </div>
      {opened && <ExpenseBudgetModal initial={opened} onClose={close} />}
    </div>
  );
}
