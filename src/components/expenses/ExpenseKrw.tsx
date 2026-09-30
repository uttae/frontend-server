import type { ExpenseKrwSummary, ExpenseKrwTotal } from "@/lib/api/rooms/expenses";
type Amount = Pick<ExpenseKrwTotal, "convertedTotalKrw" | "isComplete" | "missingCurrencies">;
export function ExpenseKrwAmount({ total }: { total?: Amount }) {
  if (!total || total.convertedTotalKrw === undefined) return <span className="block text-body-xs-regular text-text-subtle">— 원화 확인 중</span>;
  return <span className="block tabular-nums">
    {total.convertedTotalKrw === null ? "환산 불가" : <>{(!total.isComplete || total.missingCurrencies.length > 0) && "부분 합계 "}{total.convertedTotalKrw.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}원</>}
    {(!total.isComplete || total.missingCurrencies.length > 0) && <span className="block text-body-xs-regular text-text-subtle">환율 없음: {total.missingCurrencies.join(", ")}</span>}
  </span>;
}
export function ExpenseRateNote({ summary }: { summary?: Pick<ExpenseKrwSummary, "rateDate" | "rateSource" | "stale"> }) {
  if (!summary) return null;
  return <p className="mt-3 text-body-xs-regular text-text-subtle">
    {summary.rateDate ? `환율 기준일: ${summary.rateDate}` : "저장된 환율 없음"}{summary.stale && " · 이전 환율"}
    <br />출처: <a className="underline" href="https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html" target="_blank" rel="noreferrer">European Central Bank (ECB)</a>. EUR 기준 환율을 원화로 교차 환산한 참고값이며 거래·정산용이 아닙니다.
  </p>;
}
export function expenseRowKrw(summary: ExpenseKrwSummary | undefined, id: number, version: number) {
  const row = summary?.expenses?.find((item) => item.expense.id === id && item.expense.version === version);
  return row ? { ...row, convertedTotalKrw: row.convertedAmountKrw } : undefined;
}
