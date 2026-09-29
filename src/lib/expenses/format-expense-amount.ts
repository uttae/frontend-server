/** 금액 문자열에 천 단위 쉼표를 넣는다 — 소수부는 그대로 둔다 */
export function formatExpenseAmount(amount: string) {
  if (!/^-?\d*(?:\.\d*)?$/.test(amount)) return amount;
  const [integer, fraction] = amount.split(".");
  return (
    integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
    (fraction === undefined ? "" : `.${fraction}`)
  );
}
