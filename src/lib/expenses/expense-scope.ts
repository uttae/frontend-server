import type { Expense } from "@/lib/api/rooms/expenses";

export type ExpenseScope = {
  scheduleId: number;
  scheduleItemId?: number;
  label: string;
  subtitle?: string;
};

export function expensesInScope(expenses: readonly Expense[], scope: ExpenseScope) {
  return expenses.filter((expense) =>
    expense.scheduleId === scope.scheduleId &&
    (scope.scheduleItemId === undefined || expense.scheduleItemId === scope.scheduleItemId),
  );
}

function addAmounts(left: string, right: string) {
  const [leftWhole, leftFraction = ""] = left.split(".");
  const [rightWhole, rightFraction = ""] = right.split(".");
  const scale = Math.max(leftFraction.length, rightFraction.length);
  const base = BigInt(10) ** BigInt(scale);
  const toUnits = (whole: string, fraction: string) =>
    BigInt(whole) * base + BigInt(fraction.padEnd(scale, "0") || "0");
  const total = toUnits(leftWhole, leftFraction) + toUnits(rightWhole, rightFraction);
  if (scale === 0) return total.toString();
  return `${total / base}.${(total % base).toString().padStart(scale, "0")}`;
}

export function totalsByCurrency(expenses: readonly Expense[]) {
  const totals = new Map<string, string>();
  for (const expense of expenses) {
    totals.set(
      expense.currency,
      addAmounts(totals.get(expense.currency) ?? "0", expense.totalAmount),
    );
  }
  return [...totals].map(([currency, amount]) => ({ currency, amount }));
}
