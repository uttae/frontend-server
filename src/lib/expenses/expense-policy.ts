import type {
  Expense,
  ExpenseCurrency,
  ExpenseInput,
} from "@/lib/api/rooms/expenses";
import type { RoomMember } from "@/lib/api/rooms/types";
import { isExpenseCategory } from "@/lib/api/rooms/expenses";
export type MemberQueryStatus = "pending" | "error" | "success";

export function amountError(
  value: string,
  currency: ExpenseCurrency | undefined,
): string | null {
  if (!currency) return "서버 통화 목록에서 통화를 선택해 주세요.";
  const scale = currency.fractionDigits;
  const pattern = new RegExp(
    `^[0-9]{1,15}${scale ? `\\.[0-9]{${scale}}` : ""}$`,
  );
  if (!pattern.test(value))
    return `금액은 정수부 1~15자리, 소수 ${scale}자리로 입력해 주세요. 공백·기호·지수는 사용할 수 없어요.`;
  // Exact decimal strings → integer minor units. Never round, truncate or use Number.
  const units = BigInt(value.replace(".", ""));
  if (
    units <= BigInt(0) ||
    units > BigInt(currency.maximumAmount.replace(".", ""))
  )
    return `금액은 0보다 크고 ${currency.maximumAmount} 이하여야 해요.`;
  return null;
}
function selectable(m: RoomMember) {
  return (
    (m.role === "HOST" || m.role === "MEMBER") &&
    (m.status === "ACTIVE" || m.status === "LEFT")
  );
}
export function canManageExpenses(
  userId: number | undefined,
  members: RoomMember[],
  status: MemberQueryStatus,
) {
  return (
    status === "success" &&
    members.some(
      (m) => m.userId === userId && m.status === "ACTIVE" && selectable(m),
    )
  );
}
export function expensePerson(
  userId: number,
  members: RoomMember[],
  status: MemberQueryStatus,
) {
  if (status !== "success")
    return {
      userId,
      label: status === "pending" ? "멤버 확인 중" : "멤버 정보 조회 실패",
      imageUrl: null,
      unknown: false,
    };
  const m = members.find((m) => m.userId === userId);
  return {
    userId,
    label: m
      ? `${m.nickname}${m.status === "LEFT" ? " · 나간 멤버" : ""}`
      : "(알 수 없음)",
    imageUrl: m?.profileImageUrl ?? null,
    unknown: !m,
  };
}
export function roleOptions(
  members: RoomMember[],
  original: number[],
  selected: number[],
) {
  return [
    ...members
      .filter(selectable)
      .map((m) => ({ userId: m.userId, historical: false })),
    ...original
      .filter(
        (id) => selected.includes(id) && !members.some((m) => m.userId === id),
      )
      .map((userId) => ({ userId, historical: true })),
  ].sort((a, b) => a.userId - b.userId);
}
export type ExpenseDay = { scheduleId: number; items?: { itemId: number }[] };
export function validateExpense(
  body: ExpenseInput,
  currencies: ExpenseCurrency[],
  members: RoomMember[],
  original: Expense | undefined,
  days: ExpenseDay[],
): string | null {
  const error = amountError(
    body.totalAmount,
    currencies.find((c) => c.currency === body.currency),
  );
  if (error) return error;
  if (!isExpenseCategory(body.category)) return "카테고리를 선택해 주세요.";
  if ((body.memo?.length ?? 0) > 1000)
    return "메모는 1000자까지 입력할 수 있어요.";
  if (body.expenseGroup === "PREPARATION") {
    if (body.scheduleId !== null || body.scheduleItemId !== null)
      return "준비 지출은 일차·장소에 연결할 수 없어요.";
  } else if (body.expenseGroup === "TRIP_DAY") {
    const day = days.find((d) => d.scheduleId === body.scheduleId);
    if (
      !day ||
      (body.scheduleItemId !== null &&
        !day.items?.some((i) => i.itemId === body.scheduleItemId))
    )
      return "유효한 일차와 해당 일차의 장소를 선택해 주세요.";
  } else return "지출 구분을 선택해 주세요.";
  for (const role of ["payerUserIds", "participantUserIds"] as const) {
    const ids = body[role];
    if (!ids.length || new Set(ids).size !== ids.length)
      return "결제자와 부담자를 각각 한 명 이상, 중복 없이 선택해 주세요.";
    if (
      ids.some(
        (id) =>
          !Number.isSafeInteger(id) ||
          id <= 0 ||
          !(
            members.some((m) => m.userId === id && selectable(m)) ||
            (original?.[role].includes(id) &&
              !members.some((m) => m.userId === id))
          ),
      )
    )
      return "선택할 수 없는 멤버가 있어요. 멤버 목록을 확인해 주세요.";
  }
  return null;
}
