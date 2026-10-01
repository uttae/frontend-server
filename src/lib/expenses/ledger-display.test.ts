import { expect, it } from "vitest";
import { totalsByCurrency } from "./expense-scope";
import { remainingBudget } from "./ledger-display";

it("sums each original currency exactly without converting or mixing currencies", () => {
  expect(
    totalsByCurrency([
      { currency: "USD", totalAmount: "999999999999999.99" },
      { currency: "KRW", totalAmount: "300" },
      { currency: "USD", totalAmount: "0.02" },
    ]),
  ).toEqual([
    { currency: "USD", amount: "1000000000000000.01" },
    { currency: "KRW", amount: "300" },
  ]);
  expect(totalsByCurrency([])).toEqual([]);
});
it("preserves exact negative and fractional remaining budgets", () => {
  expect(remainingBudget("1000", "501")).toBe("499");
  expect(remainingBudget("1000", "1000.01")).toBe("-0.01");
  expect(remainingBudget("999999999999999", "0.01")).toBe("999999999999998.99");
});
