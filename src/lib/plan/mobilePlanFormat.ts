import type { Expense } from "@/lib/api/rooms/expenses";
import { totalsByCurrency } from "@/lib/expenses/expense-scope";
import { formatExpenseAmount } from "@/lib/expenses/format-expense-amount";
import { parseLocalYmd } from "@/lib/plan/tripRange";

const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

export function formatMobileDayDate(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "";
  const d = parseLocalYmd(ymd);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}. ${dd} ${WEEKDAYS_KO[d.getDay()]}`;
}

export function formatMonthDayKo(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "";
  const d = parseLocalYmd(ymd);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function summarizePlaceExpenses(expenses: readonly Expense[]): string | null {
  if (expenses.length === 0) return null;
  const countByCurrency = new Map<string, number>();
  for (const expense of expenses) {
    countByCurrency.set(expense.currency, (countByCurrency.get(expense.currency) ?? 0) + 1);
  }
  const totals = totalsByCurrency(expenses);
  const [first, ...rest] = totals;
  if (!first) return null;
  const primary = rest.reduce(
    (best, current) =>
      (countByCurrency.get(current.currency) ?? 0) > (countByCurrency.get(best.currency) ?? 0) ? current : best,
    first,
  );
  const others = expenses.length - (countByCurrency.get(primary.currency) ?? 0);
  const label = `${formatExpenseAmount(primary.amount)} ${primary.currency}`;
  return others > 0 ? `${label} 외 ${others}건` : label;
}
