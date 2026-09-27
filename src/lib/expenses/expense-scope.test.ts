import { expect, it } from "vitest";
import type { Expense } from "@/lib/api/rooms/expenses";
import { expensesInScope, totalsByCurrency } from "./expense-scope";

const expense = (id: number, scheduleId: number | null, scheduleItemId: number | null, currency: string, totalAmount: string) => ({
  id,
  scheduleId,
  scheduleItemId,
  currency,
  totalAmount,
}) as Expense;

it("separates a day's costs from a place's costs and keeps currency totals exact", () => {
  const records = [
    expense(1, 10, 100, "KRW", "999999999999999"),
    expense(2, 10, 100, "KRW", "1"),
    expense(3, 10, null, "USD", "10.25"),
    expense(4, 11, 100, "KRW", "50"),
    expense(5, null, null, "KRW", "20"),
    expense(6, 10, null, "USD", "0.05"),
  ];

  const day = expensesInScope(records, { scheduleId: 10, label: "1일차" });
  const place = expensesInScope(records, { scheduleId: 10, scheduleItemId: 100, label: "장소" });
  expect(day.map((record) => record.id)).toEqual([1, 2, 3, 6]);
  expect(place.map((record) => record.id)).toEqual([1, 2]);
  expect(totalsByCurrency(day)).toEqual([
    { currency: "KRW", amount: "1000000000000000" },
    { currency: "USD", amount: "10.30" },
  ]);
});
