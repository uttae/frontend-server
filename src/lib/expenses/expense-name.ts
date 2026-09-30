import { expenseCategoryLabel, type Expense } from "@/lib/api/rooms/expenses";
// Java Character.isWhitespace, deliberately excluding NBSP, figure space and narrow NBSP.
const edgeWhitespace = /^[\u0009-\u000d\u001c-\u0020\u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000]+|[\u0009-\u000d\u001c-\u0020\u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000]+$/g;
export function normalizeExpenseName(name: string | null | undefined): string | null {
  return name?.replace(edgeWhitespace, "") || null;
}
export function expenseNameError(name: string | null | undefined): string | null {
  return name && name.length > 100 ? "이름은 공백을 포함해 100자 이내로 입력해 주세요." : null;
}
export function expenseTitle(expense: Pick<Expense, "name" | "category">): string {
  return normalizeExpenseName(expense.name) ?? expenseCategoryLabel(expense.category);
}
