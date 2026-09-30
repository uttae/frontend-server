import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/lib/api/config", () => ({ API_BASE: "http://fixture" }));
import { ExpenseKrwAmount, ExpenseRateNote } from "./ExpenseKrw";
it("distinguishes missing, partial zero, complete zero and preserves exact server integers", () => {
 const html = (amount: string | null, complete: boolean) => renderToStaticMarkup(<ExpenseKrwAmount total={{ convertedTotalKrw: amount, isComplete: complete, missingCurrencies: complete ? [] : ["KWD"] }} />);
 expect(html(null, false)).toContain("환산 불가");
 expect(html("0", false)).toContain("부분 합계");
 expect(html("0", false)).toContain("0원");
 expect(html("0", true)).not.toContain("부분 합계");
 expect(html("501", true)).toContain("501원");
 expect(html("1001", true)).toContain("1,001원");
 expect(html("9999999999999999999", true)).toContain("9,999,999,999,999,999,999원");
});
it("shows ECB attribution, snapshot date and stale independently from completeness", () => {
 const html = renderToStaticMarkup(<ExpenseRateNote summary={{ rateDate: "2026-09-29", stale: true, rateSource: "ECB" }} />);
 expect(html).toContain("European Central Bank (ECB)");
 expect(html).toContain("거래·정산용이 아닙니다");
 expect(html).toContain("2026-09-29");
 expect(html).toContain("이전 환율");
 expect(html).toContain("https://www.ecb.europa.eu/");
});

import fixture from "./krw-contract.fixture.json";
import type { ExpenseKrwSummary } from "@/lib/api/rooms/expenses";
import { ExpenseList, ExpenseSummaryView } from "./ExpenseViews";
import { expenseRowKrw } from "./ExpenseKrw";
const response = fixture.response as ExpenseKrwSummary;
it("renders authoritative row 501 + 501 and day/payer 1001 without summing rounded rows", () => {
 const html = renderToStaticMarkup(<ExpenseList expenses={response.expenses.map(row => row.expense)} krwSummary={response} grouped schedules={[]} members={[]} memberStatus="success" canManage={false} busy={false} onEdit={() => {}} onDelete={() => {}} />);
 expect(html.match(/501원/g)).toHaveLength(2);
 expect(html.match(/1,001원/g)).toHaveLength(1);
 expect(html).not.toContain("1,002원");
 const settlement = renderToStaticMarkup(<ExpenseSummaryView summary={{ currencies: [] }} krwSummary={response} members={[]} memberStatus="success" scope="all" />);
 expect(settlement).toContain("1,001원");
 expect(expenseRowKrw(response, 1, 99)).toBeUndefined();
});
it.each([
 ["5", true, [], "5원"], ["0", true, [], "0원"],
 [null, false, ["KWD"], "환산 불가"], ["0", false, ["KWD"], "부분 합계"],
] as const)("renders server payer allocation %s without recomputing shares", (amount, complete, missing, expected) => {
 const summary: ExpenseKrwSummary = { ...response, payers: [{ userId: 1, total: { originalTotals: [], convertedTotalKrw: amount, isComplete: complete, missingCurrencies: [...missing] } }] };
 const html = renderToStaticMarkup(<ExpenseSummaryView summary={{ currencies: [] }} krwSummary={summary} members={[]} memberStatus="success" scope="all" />);
 expect(html).toContain(expected);
});
