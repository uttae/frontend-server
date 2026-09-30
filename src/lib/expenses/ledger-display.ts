/** Decimal arithmetic for display totals; never round through JS Number. */
function scaled(value: string, precision: number) {
  const negative = value.startsWith("-");
  const [integer, fraction = ""] = value.replace(/^-/, "").split(".");
  const amount = BigInt(integer + fraction.padEnd(precision, "0"));
  return negative ? -amount : amount;
}
function decimal(value: bigint, precision: number) {
  const sign = value < BigInt(0) ? "-" : "";
  const digits = (value < BigInt(0) ? -value : value)
    .toString()
    .padStart(precision + 1, "0");
  return (
    sign +
    (precision
      ? `${digits.slice(0, -precision)}.${digits.slice(-precision)}`
      : digits)
  );
}
function precisionOf(value: string) {
  return value.split(".")[1]?.length ?? 0;
}
export function remainingBudget(budget: string, spent: string) {
  const precision = Math.max(precisionOf(budget), precisionOf(spent));
  return decimal(
    scaled(budget, precision) - scaled(spent, precision),
    precision,
  );
}
