"use client";

import { ExpenseKrwAmount } from "./ExpenseKrw";
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
    <div className="@container/expense-budget space-y-3">
      <div className="space-y-3 text-body-s-regular mobile:text-body-xs-regular">
        <h3 className="text-[16px] leading-6 font-medium text-text mobile:text-[14px] mobile:text-text-subtle max-sm:text-[14px] max-sm:text-text-subtle">
          여행 전체 비용
        </h3>
        {krwSummary.isPending && (
          <output style={{ display: "block" }} className="sr-only">
            원화 참고 요약을 불러오는 중…
          </output>
        )}
        {krwSummary.isError && (
          <p role="alert" className="text-status-negative">
            원화 참고 요약 조회에 실패했어요. 이전 값은 최신 상태가 아닐 수
            있어요. 조회 다시 시도 버튼을 눌러 주세요.
          </p>
        )}
        <p aria-busy={krwSummary.isPending} className="overflow-x-auto whitespace-nowrap text-[clamp(20px,9cqi,32px)] leading-[1.3] font-bold text-primary tabular-nums">
          <ExpenseKrwAmount total={reference} showNote />
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
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white mobile:pt-3 max-sm:pt-3">
        <div className="contents">
          <h3 className="text-[14px] leading-5 text-text-subtle">
            전체 예산
          </h3>
          {budget.isPending && (
            <>
              <output style={{ display: "block" }} className="sr-only">예산을 불러오는 중…</output>
              <span aria-hidden="true" className="ml-auto text-text-subtle">—</span>
            </>
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
            <p className="ml-auto break-all text-[16px] leading-5 font-medium tabular-nums mobile:order-3 mobile:text-[18px] mobile:font-bold mobile:text-text-subtle max-sm:order-3 max-sm:text-[18px] max-sm:font-bold max-sm:text-text-subtle">
              {amount === null ? "—" : `${formatExpenseAmount(amount!)}원`}
            </p>
          )}
        </div>
        {canManage && budget.isSuccess && (
          <button
            type="button"
            aria-label={amount === null ? "예산 설정" : "예산 수정"}
            className="flex h-5 w-4 shrink-0 cursor-pointer disabled:cursor-not-allowed items-center justify-center rounded-md text-text-subtle hover:bg-fill focus-visible:outline-2 focus-visible:outline-primary"
            disabled={budgetBusy}
            onClick={() => setOpened(budget.data)}
          >
            <WriteIcon size={16} />
          </button>
        )}
      </div>
      <div
        aria-label="남은 예산"
        className="flex items-center justify-between gap-2 text-[14px] leading-5 text-text-subtle mobile:text-primary max-sm:text-primary"
      >
        <span>남은 예산</span>
        <p className="break-all text-right text-[18px] leading-[26px] font-bold text-text tabular-nums mobile:text-primary max-sm:text-primary">
          {(syncStatus === "ready" || syncStatus === "refreshing") &&
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
