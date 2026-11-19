export function formatExpenseAmount(amount: string) {
  if (!/^-?\d*(?:\.\d*)?$/.test(amount)) return amount;
  const [integer, fraction] = amount.split(".");
  const sign = integer.startsWith("-") ? "-" : "";
  const digits = sign ? integer.slice(1) : integer;
  const grouped: string[] = [];
  for (let index = 0; index < digits.length; index += 1) {
    if (index > 0 && (digits.length - index) % 3 === 0) grouped.push(",");
    grouped.push(digits[index]);
  }
  return sign + grouped.join("") + (fraction === undefined ? "" : `.${fraction}`);
}
