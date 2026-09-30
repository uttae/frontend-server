"use client";

import { useId } from "react";
import { Info, X } from "lucide-react";
import type { Expense, ExpenseKrwSummary, ExpenseKrwTotal } from "@/lib/api/rooms/expenses";
import { formatExpenseAmount } from "@/lib/expenses/format-expense-amount";

type Amount = Pick<ExpenseKrwTotal, "convertedTotalKrw" | "isComplete" | "missingCurrencies">;
type OriginalAmount = { currency: string; amount: string };

export function ExpenseKrwAmount({ total, original }: { total?: Amount; original?: OriginalAmount }) {
  const noteId = useId();
  if (!total || total.convertedTotalKrw === undefined) {
    return <span className="block text-text-subtle" aria-label="원화 금액 확인 중">—</span>;
  }
  const unavailable = total.convertedTotalKrw === null;
  const needsNote = unavailable || !total.isComplete || total.missingCurrencies.length > 0;
  const amount = unavailable
    ? original ? `${original.currency} ${formatExpenseAmount(original.amount)}` : "—"
    : `${formatExpenseAmount(total.convertedTotalKrw!)}원`;
  const currencies = total.missingCurrencies.join(", ");
  const explanation = unavailable
    ? "환율을 확인할 수 없어 원화로 환산하지 않았어요. 원래 결제 금액은 그대로 유지돼요."
    : currencies
      ? `${currencies} 비용은 원화 합계에 포함되지 않았어요.`
      : "환율을 확인할 수 있는 비용만 합산했어요.";
  return (
    <span className="inline-flex max-w-full items-center gap-1 align-middle tabular-nums">
      <span className="min-w-0 break-all">{amount}</span>
      {needsNote && (
        <>
          <button type="button" popoverTarget={noteId} aria-label="원화 합계 안내"
            className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-text-subtle hover:bg-fill focus-visible:outline-2 focus-visible:outline-primary">
            <Info size={14} aria-hidden="true" />
          </button>
          <span id={noteId} popover="auto" role="note" aria-label="원화 합계 안내"
            className="fixed inset-0 m-auto w-[calc(100%-2.5rem)] max-w-xs rounded-xl border border-border-subtle bg-white p-4 text-left text-[14px] font-normal leading-5 text-text shadow-lg">
            <span className="mb-2 flex items-center justify-between gap-3 font-semibold">
              원화 합계 안내
              <button type="button" popoverTarget={noteId} popoverTargetAction="hide" aria-label="원화 합계 안내 닫기"
                className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-subtle hover:bg-fill focus-visible:outline-2 focus-visible:outline-primary">
                <X size={16} aria-hidden="true" />
              </button>
            </span>
            <span>{explanation}</span>
          </span>
        </>
      )}
    </span>
  );
}

export function ExpenseRowAmount({ expense, summary }: { expense: Expense; summary?: ExpenseKrwSummary }) {
  const total = expenseRowKrw(summary, expense.id, expense.version);
  return <>
    <ExpenseKrwAmount total={total} original={{ currency: expense.currency, amount: expense.totalAmount }} />
    {total?.convertedTotalKrw !== null && (
      <span className="mt-1 block text-[12px] leading-4 font-normal text-text-subtle @min-[800px]/expenses:text-[13px] @min-[800px]/expenses:leading-[18px]">
        {expense.currency} {formatExpenseAmount(expense.totalAmount)}
      </span>
    )}
  </>;
}

export function ExpenseRateNote({ summary }: { summary?: Pick<ExpenseKrwSummary, "rateDate" | "rateSource" | "stale"> }) {
  if (!summary) return null;
  return <p className="mt-3 text-body-xs-regular text-text-subtle">
    {summary.rateDate ? `환율 기준일: ${summary.rateDate}` : "저장된 환율 없음"}{summary.stale && " · 이전 환율"}
    <br />출처: <a className="underline" href="https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html" target="_blank" rel="noreferrer">European Central Bank (ECB)</a>. EUR 기준 환율을 원화로 교차 환산한 참고값이며 거래·정산용이 아닙니다.
  </p>;
}
export function expenseRowKrw(summary: ExpenseKrwSummary | undefined, id: number, version: number) {
  const row = summary?.expenses?.find((item) => item.expense.id === id && item.expense.version === version);
  return row ? { ...row, convertedTotalKrw: row.convertedAmountKrw } : undefined;
}
