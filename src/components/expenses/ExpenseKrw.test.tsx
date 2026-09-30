// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/lib/api/config", () => ({ API_BASE: "http://fixture" }));
import { ExpenseKrwAmount, ExpenseRateNote } from "./ExpenseKrw";
it("distinguishes missing, partial zero, complete zero and preserves exact server integers", () => {
 const html = (amount: string | null, complete: boolean) => renderToStaticMarkup(<ExpenseKrwAmount total={{ convertedTotalKrw: amount, isComplete: complete, missingCurrencies: complete ? [] : ["KWD"] }} />);
 expect(html(null, false)).toContain("—");
 expect(html("0", false)).toContain("원화 합계 안내");
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
 [null, false, ["KWD"], "—"], ["0", false, ["KWD"], "0원"],
] as const)("renders server payer allocation %s without recomputing shares", (amount, complete, missing, expected) => {
 const summary: ExpenseKrwSummary = { ...response, payers: [{ userId: 1, total: { originalTotals: [], convertedTotalKrw: amount, isComplete: complete, missingCurrencies: [...missing] } }] };
 const html = renderToStaticMarkup(<ExpenseSummaryView summary={{ currencies: [] }} krwSummary={summary} members={[]} memberStatus="success" scope="all" />);
 expect(html).toContain(expected);
});
it("keeps each server payer total in that member's settlement row beside original-currency balances", () => {
 const html = renderToStaticMarkup(<ExpenseSummaryView scope="all" members={[]} memberStatus="success" krwSummary={response} summary={{ currencies: [{ currency: "USD", totalAmount: "2.00", categories: [], days: [], individuals: [{ userId: 1, paidAmount: "2.00", owedAmount: "1.00", netAmount: "1.00" }], transfers: [] }] }} />);
 const row = html.split('data-settlement-user-id="1"')[1]?.split('</div></div>')[0];
 expect(row).toBeDefined();
 expect(row).toContain("1,001원");
 expect(row).toContain("USD 2.00");
 expect(row).toContain("USD 1.00");
 expect(html).not.toContain('aria-label="결제자별 원화 합계"');
});

function amountMarkup(total?: Parameters<typeof ExpenseKrwAmount>[0]["total"], original?: Parameters<typeof ExpenseKrwAmount>[0]["original"]) {
 const host = document.createElement("div");
 host.innerHTML = renderToStaticMarkup(<ExpenseKrwAmount total={total} original={original} />);
 return host;
}
it("keeps an incomplete total numeric and puts excluded currencies behind an accessible disclosure", () => {
 const host = amountMarkup({ convertedTotalKrw: "1234567", isComplete: false, missingCurrencies: ["AED"] });
 const trigger = host.querySelector('button[aria-label="원화 합계 안내"]');
 const note = host.querySelector('[popover]');
 expect(trigger).not.toBeNull();
 expect(note?.id).toBe(trigger?.getAttribute("popovertarget"));
 expect(note?.textContent).toContain("AED");
 expect(note?.textContent).toContain("포함되지 않았어요");
 note?.remove();
 expect(host.textContent).toBe("1,234,567원");
});
it("uses the original currency once for a non-convertible row instead of an error stack", () => {
 const broken = { ...response, expenses: [{ ...response.expenses[0], expense: { ...response.expenses[0].expense, currency: "AED", totalAmount: "50.00" }, convertedAmountKrw: null, isComplete: false, missingCurrencies: ["AED"] }] };
 const host = document.createElement("div");
 host.innerHTML = renderToStaticMarkup(<ExpenseList expenses={[broken.expenses[0].expense]} krwSummary={broken} schedules={[]} members={[]} memberStatus="success" canManage={false} busy={false} onEdit={() => {}} onDelete={() => {}} />);
 host.querySelectorAll('[popover]').forEach(node => node.remove());
 expect(host.textContent?.match(/AED 50.00/g)).toHaveLength(1);
 expect(host.textContent).not.toMatch(/환산 불가|환율 없음|부분 합계/);
});
it("distinguishes unavailable totals from known zero without visible loading copy", () => {
 const pending = amountMarkup();
 expect(pending.textContent).toBe("—");
 expect(pending.querySelector('button')).toBeNull();
 const missing = amountMarkup({ convertedTotalKrw: null, isComplete: false, missingCurrencies: ["AED"] });
 missing.querySelector('[popover]')?.remove();
 expect(missing.textContent).toBe("—");
 const zero = amountMarkup({ convertedTotalKrw: "0", isComplete: true, missingCurrencies: [] });
 expect(zero.textContent).toBe("0원");
 expect(zero.querySelector('button')).toBeNull();
});
