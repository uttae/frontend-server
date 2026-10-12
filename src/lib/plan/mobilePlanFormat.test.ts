import { describe, expect, it } from "vitest";

import type { Expense } from "@/lib/api/rooms/expenses";

import { formatMobileDayDate, formatMonthDayKo, summarizeExpensesInKrw } from "./mobilePlanFormat";

function expense(currency: string, totalAmount: string, id: number): Expense {
  return { id, currency, totalAmount } as Expense;
}

describe("formatMonthDayKo", () => {
  it("월·일을 앞자리 0 없이 표시한다", () => {
    expect(formatMonthDayKo("2026-09-08")).toBe("9월 8일");
    expect(formatMonthDayKo("2026-12-25")).toBe("12월 25일");
  });

  it("형식이 맞지 않으면 빈 문자열", () => {
    expect(formatMonthDayKo("")).toBe("");
  });
});

describe("formatMobileDayDate", () => {
  it("월·일을 두 자리로 맞추고 요일을 붙인다", () => {
    expect(formatMobileDayDate("2026-09-21")).toBe("09. 21 월");
    expect(formatMobileDayDate("2026-12-05")).toBe("12. 05 토");
  });

  it("형식이 맞지 않으면 빈 문자열", () => {
    expect(formatMobileDayDate("")).toBe("");
    expect(formatMobileDayDate("2026/09/21")).toBe("");
  });
});

describe("summarizeExpensesInKrw", () => {
  it("비용이 없으면 null", () => {
    expect(summarizeExpensesInKrw([])).toBeNull();
  });

  it("원화 비용 합계 하나만 보여준다", () => {
    expect(
      summarizeExpensesInKrw([
        expense("KRW", "45000", 1),
        expense("USD", "50.00", 2),
        expense("KRW", "5000", 3),
      ]),
    ).toBe("50,000 KRW");
  });

  it("원화 비용이 없으면 null", () => {
    expect(summarizeExpensesInKrw([expense("JPY", "3600", 1)])).toBeNull();
  });
});
