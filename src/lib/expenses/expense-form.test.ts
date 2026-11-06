import { describe, expect, it } from "vitest";

import type { RoomMember } from "@/lib/api/rooms/types";

import {
  createExpenseFormSchema,
  EXPENSE_BUDGET_INVALID_MESSAGE,
  expenseBudgetSchema,
  expenseCategorySchema,
  expenseMemoSchema,
  expenseNameSchema,
} from "./expense-form";

const usd = { currency: "USD", fractionDigits: 2, maximumAmount: "999999999999999.99" };
const member = (userId: number): RoomMember => ({
  userId,
  status: "ACTIVE",
  role: "MEMBER",
  nickname: `멤버${userId}`,
  profileImageUrl: null,
  joinedAt: "",
  isOnline: false,
});
const values = {
  expenseGroup: "PREPARATION" as const,
  scheduleId: null,
  scheduleItemId: null,
  totalAmount: "10.01",
  currency: "USD",
  category: "OTHER" as const,
  name: null,
  memo: "",
  payerUserIds: [1],
  participantUserIds: [1],
};
const schema = createExpenseFormSchema({
  currencies: [usd],
  members: [member(1)],
  original: undefined,
  daysOf: () => [{ scheduleId: 10, items: [{ itemId: 100 }] }],
});
const issuesOf = (result: { error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  result.error?.issues.map(({ path, message }) => ({ path, message })) ?? [];

describe("createExpenseFormSchema", () => {
  it("passes a valid expense", () => {
    expect(schema.safeParse(values).success).toBe(true);
  });

  // issue path가 화면의 form.Field name과 같아야 그 칸에 붙는다
  it("puts cross-field issues on the amount, linked place and payer fields", () => {
    expect(issuesOf(schema.safeParse({ ...values, totalAmount: "10.001" }))).toEqual([
      {
        path: ["totalAmount"],
        message: "금액은 정수부 1~15자리, 소수 2자리로 입력해 주세요. 공백·기호·지수는 사용할 수 없어요.",
      },
    ]);
    expect(issuesOf(schema.safeParse({ ...values, currency: "JPY" }))).toEqual([
      { path: ["totalAmount"], message: "서버 통화 목록에서 통화를 선택해 주세요." },
    ]);
    expect(issuesOf(schema.safeParse({ ...values, expenseGroup: "TRIP_DAY", scheduleId: 10, scheduleItemId: 999 }))).toEqual([
      { path: ["scheduleItemId"], message: "유효한 일차와 해당 일차의 장소를 선택해 주세요." },
    ]);
    expect(issuesOf(schema.safeParse({ ...values, participantUserIds: [] }))).toEqual([
      { path: ["payerUserIds"], message: "결제자와 부담자를 각각 한 명 이상, 중복 없이 선택해 주세요." },
    ]);
  });

  it("leaves single-field rules to the field schemas", () => {
    expect(schema.safeParse({ ...values, category: "", memo: "가".repeat(1001) }).success).toBe(true);
  });
});

describe("expense field schemas", () => {
  it("returns one issue with the existing message", () => {
    expect(issuesOf(expenseCategorySchema.safeParse(""))).toEqual([{ path: [], message: "카테고리를 선택해 주세요." }]);
    expect(issuesOf(expenseMemoSchema.safeParse("가".repeat(1001)))).toEqual([
      { path: [], message: "메모는 1000자까지 입력할 수 있어요." },
    ]);
    expect(issuesOf(expenseNameSchema.safeParse("가".repeat(101)))).toEqual([
      { path: [], message: "제목은 공백을 포함해 100자 이내로 입력해 주세요." },
    ]);
    expect(expenseNameSchema.safeParse(undefined).success).toBe(true);
    expect(expenseMemoSchema.safeParse(null).success).toBe(true);
  });
});

describe("expenseBudgetSchema", () => {
  it.each(["0", "1", "999999999999999"])("accepts %s", (value) => {
    expect(expenseBudgetSchema.safeParse(value).success).toBe(true);
  });
  it.each(["", "-1", "1.5", " 1", "1000000000000000"])("rejects %s with the budget message", (value) => {
    expect(issuesOf(expenseBudgetSchema.safeParse(value))).toEqual([
      { path: [], message: EXPENSE_BUDGET_INVALID_MESSAGE },
    ]);
  });
});
