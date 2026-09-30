"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { Info, X } from "lucide-react";
import type { Expense, ExpenseKrwSummary, ExpenseKrwTotal } from "@/lib/api/rooms/expenses";
import { formatExpenseAmount } from "@/lib/expenses/format-expense-amount";

type Amount = Pick<ExpenseKrwTotal, "convertedTotalKrw" | "isComplete" | "missingCurrencies">;
type OriginalAmount = { currency: string; amount: string };

type NotePosition = { left: number; top: number; maxHeight: number };

function useExpenseNotePosition() {
  const trigger = useRef<HTMLButtonElement>(null);
  const note = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<NotePosition | null>(null);

  useLayoutEffect(() => {
    if (!open || !trigger.current || !note.current) return;
    const button = trigger.current;
    const popup = note.current;
    const update = () => {
      const anchor = button.getBoundingClientRect();
      if (anchor.bottom < 0 || anchor.top > window.innerHeight) {
        popup.hidePopover();
        return;
      }
      const bounds = popup.getBoundingClientRect();
      const margin = 12;
      const gap = 8;
      const below = Math.max(0, window.innerHeight - anchor.bottom - gap - margin);
      const above = Math.max(0, anchor.top - gap - margin);
      const useBelow = bounds.height <= below || below >= above;
      const next = {
        left: Math.max(margin, Math.min(anchor.right - bounds.width, window.innerWidth - bounds.width - margin)),
        top: useBelow ? anchor.bottom + gap : Math.max(margin, anchor.top - gap - Math.min(bounds.height, above)),
        maxHeight: useBelow ? below : above,
      };
      setPosition(previous => previous && previous.left === next.left && previous.top === next.top && previous.maxHeight === next.maxHeight ? previous : next);
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(update);
    observer?.observe(popup);
    observer?.observe(button);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, [open]);

  function onToggle() {
    const isOpen = note.current?.matches(":popover-open") ?? false;
    setOpen(isOpen);
    if (!isOpen) setPosition(null);
  }
  return { trigger, note, position, onToggle };
}

function ExpenseConversionNote({ explanation }: { explanation: string }) {
  const noteId = useId();
  const { trigger, note, position, onToggle } = useExpenseNotePosition();
  return (
        <>
          <button ref={trigger} type="button" popoverTarget={noteId} aria-label="원화 합계 안내"
            className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-text-subtle hover:bg-fill focus-visible:outline-2 focus-visible:outline-primary">
            <Info size={14} aria-hidden="true" />
          </button>
          <span ref={note} id={noteId} popover="auto" role="note" aria-label="원화 합계 안내"
            onToggle={onToggle}
            style={{ left: position?.left, top: position?.top, maxHeight: position?.maxHeight, visibility: position ? "visible" : "hidden" }}
            className="fixed inset-auto m-0 w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-xl border border-border-subtle bg-white p-4 text-left text-[14px] font-normal leading-5 text-text shadow-lg">
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
  );
}

export function ExpenseKrwAmount({ total, original }: { total?: Amount; original?: OriginalAmount }) {
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
        <ExpenseConversionNote explanation={explanation} />
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
