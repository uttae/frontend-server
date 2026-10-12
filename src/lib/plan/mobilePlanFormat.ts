import type { Expense } from "@/lib/api/rooms/expenses";
import { totalsByCurrency } from "@/lib/expenses/expense-scope";
import { formatExpenseAmount } from "@/lib/expenses/format-expense-amount";
import { parseLocalYmd } from "@/lib/plan/tripRange";

const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

/** 모바일 일차 헤더 날짜 — `YYYY-MM-DD` → `09. 21 수` */
export function formatMobileDayDate(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "";
  const d = parseLocalYmd(ymd);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}. ${dd} ${WEEKDAYS_KO[d.getDay()]}`;
}

/** `2026-09-28` → `9월 28일` */
export function formatMonthDayKo(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "";
  const d = parseLocalYmd(ymd);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/**
 * 일정 비용 요약(PC·모바일 일정 카드와 일차) — 원화(KRW) 합계 하나만 보인다(예: `130,200 KRW`).
 * 다른 통화 비용은 가계부에서 본다. 원화 비용이 없으면 null.
 */
export function summarizeExpensesInKrw(expenses: readonly Expense[]): string | null {
  const krw = totalsByCurrency(expenses).find((total) => total.currency === "KRW");
  return krw ? `${formatExpenseAmount(krw.amount)} KRW` : null;
}
