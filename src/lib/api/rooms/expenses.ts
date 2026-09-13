import { apiFetch } from "@/lib/api/client";
import { apiUrl, jsonBody, tryParseJson } from "@/lib/api/http";

export type ExpenseGroup = "PREPARATION" | "TRIP_DAY";
// Approved API enum order; labels are client-side display text.
export const expenseCategories = [
  { value: "FLIGHT", label: "항공" },
  { value: "ACCOMMODATION", label: "숙박" },
  { value: "FOOD", label: "식사" },
  { value: "TRANSPORT", label: "교통" },
  { value: "SHOPPING", label: "쇼핑" },
  { value: "SIGHTSEEING", label: "관광" },
  { value: "OTHER", label: "기타" },
] as const;
export type ExpenseCategory = (typeof expenseCategories)[number]["value"];
export function isExpenseCategory(value: unknown): value is ExpenseCategory {
  return expenseCategories.some((category) => category.value === value);
}
export function expenseCategoryLabel(value: ExpenseCategory): string {
  return (
    expenseCategories.find((category) => category.value === value)?.label ??
    value
  );
}
export type ExpenseInput = {
  expenseGroup: ExpenseGroup;
  scheduleId: number | null;
  scheduleItemId: number | null;
  totalAmount: string;
  currency: string;
  category: ExpenseCategory;
  memo: string | null;
  payerUserIds: number[];
  participantUserIds: number[];
};
export type Expense = ExpenseInput & {
  id: number;
  createdAt: string;
  updatedAt: string;
};
export type ExpenseCurrency = {
  currency: string;
  fractionDigits: number;
  maximumAmount: string;
};
export type ExpenseSummary = {
  currencies: {
    currency: string;
    totalAmount: string;
    individuals: {
      userId: number;
      paidAmount: string;
      owedAmount: string;
      netAmount: string;
    }[];
    transfers: { fromUserId: number; toUserId: number; amount: string }[];
    categories: { category: ExpenseCategory; totalAmount: string }[];
    days: {
      expenseGroup: ExpenseGroup;
      scheduleId: number | null;
      totalAmount: string;
    }[];
  }[];
};
export class ExpenseApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
async function request<T>(
  roomId: string,
  suffix = "",
  init?: RequestInit,
): Promise<T> {
  const res = await apiFetch(
    apiUrl(`/rooms/${roomId}/expenses${suffix}`),
    init,
  );
  if (!res.ok) {
    const body = (await tryParseJson(res)) as {
      code?: string;
      message?: string;
    } | null;
    throw new ExpenseApiError(
      res.status,
      body?.code ?? "UNKNOWN",
      body?.message ?? "지출 요청에 실패했어요. 다시 시도해 주세요.",
    );
  }
  return res.status === 204 ? (undefined as T) : (res.json() as Promise<T>);
}
export const getExpenses = (roomId: string) => request<Expense[]>(roomId);
export const getExpenseSummary = (roomId: string) =>
  request<ExpenseSummary>(roomId, "/summary");
export const getExpenseCurrencies = (roomId: string) =>
  request<ExpenseCurrency[]>(roomId, "/currencies");
export const createExpense = (roomId: string, body: ExpenseInput) =>
  request<Expense>(roomId, "", { method: "POST", ...jsonBody(body) });
export const patchExpense = (
  roomId: string,
  id: number,
  body: Partial<ExpenseInput>,
) => request<Expense>(roomId, `/${id}`, { method: "PATCH", ...jsonBody(body) });
export const deleteExpense = (roomId: string, id: number) =>
  request<void>(roomId, `/${id}`, { method: "DELETE" });
