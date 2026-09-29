import { describe, expect, it } from "vitest";

import type { Expense } from "@/lib/api/rooms/expenses";

import { formatMobileDayDate, summarizeExpensesForMobile } from "./mobilePlanFormat";

function expense(currency: string, totalAmount: string, id: number): Expense {
  return { id, currency, totalAmount } as Expense;
}

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

describe("summarizeExpensesForMobile", () => {
  it("지출이 없으면 null", () => {
    expect(summarizeExpensesForMobile([])).toBeNull();
  });

  it("통화가 하나면 합계만 보여준다", () => {
    expect(
      summarizeExpensesForMobile([expense("KRW", "45000", 1), expense("KRW", "5000", 2)]),
    ).toBe("50,000 KRW");
  });

  it("지출이 가장 많은 통화 합계에 다른 통화 지출 건수를 붙인다", () => {
    expect(
      summarizeExpensesForMobile([
        expense("AFN", "123.00", 1),
        expense("KRW", "300", 2),
        expense("KRW", "57", 3),
      ]),
    ).toBe("357 KRW 외 1건");
  });

  it("건수가 같으면 먼저 나온 통화를 쓴다", () => {
    expect(
      summarizeExpensesForMobile([expense("JPY", "3600", 1), expense("KRW", "1000", 2)]),
    ).toBe("3,600 JPY 외 1건");
  });
});
