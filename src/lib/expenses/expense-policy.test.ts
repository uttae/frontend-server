import { describe, expect, it } from "vitest";
import type { ExpenseInput } from "@/lib/api/rooms/expenses";
import type { RoomMember } from "@/lib/api/rooms/types";
import {
  amountError,
  canManageExpenses,
  expensePerson,
  roleOptions,
  validateExpense,
} from "./expense-policy";
const usd = {
  currency: "USD",
  fractionDigits: 2,
  maximumAmount: "999999999999999.99",
};
const member = (userId: number, status: RoomMember["status"]): RoomMember => ({
  userId,
  status,
  role: "MEMBER",
  nickname: `멤버${userId}`,
  profileImageUrl: null,
  joinedAt: "",
  isOnline: false,
});
const members = [member(1, "ACTIVE"), member(2, "LEFT"), member(3, "PENDING")];
const body = {
  expenseGroup: "PREPARATION" as const,
  scheduleId: null,
  scheduleItemId: null,
  totalAmount: "10.01",
  currency: "USD",
  category: "OTHER" as const,
  memo: "",
  payerUserIds: [1],
  participantUserIds: [2],
};
describe("expense decimal contract", () => {
  it.each(["10.01", "999999999999999.99", "000000000000001.00", "0.01"])(
    "accepts precise USD %s",
    (v) => expect(amountError(v, usd)).toBeNull(),
  );
  it.each([
    "10",
    "10.0",
    "10.001",
    "0.00",
    "-1.00",
    "+1.00",
    "1e2",
    " 1.00",
    "1,000.00",
    "1000000000000000.00",
    "0000000000000001.00",
  ])("rejects %s without repair", (v) =>
    expect(amountError(v, usd)).not.toBeNull(),
  );
  it("uses server scale and maximum, including 0 and 3 decimals", () => {
    expect(
      amountError("100", {
        currency: "KRW",
        fractionDigits: 0,
        maximumAmount: "100",
      }),
    ).toBeNull();
    expect(
      amountError("101", {
        currency: "KRW",
        fractionDigits: 0,
        maximumAmount: "100",
      }),
    ).not.toBeNull();
    expect(
      amountError("0.001", {
        currency: "KWD",
        fractionDigits: 3,
        maximumAmount: "999999999999999.999",
      }),
    ).toBeNull();
    expect(amountError("1.00", undefined)).not.toBeNull();
  });
});
describe("expense roles and links", () => {
  it("permits only ACTIVE HOST/MEMBER management after successful members query", () => {
    expect(canManageExpenses(1, members, "success")).toBe(true);
    for (const id of [2, 3, 99])
      expect(canManageExpenses(id, members, "success")).toBe(false);
    expect(canManageExpenses(1, members, "error")).toBe(false);
  });
  it("distinguishes unknown, loading and errors and labels LEFT", () => {
    expect(expensePerson(99, members, "success").label).toBe("(알 수 없음)");
    expect(expensePerson(99, members, "pending").label).toBe("멤버 확인 중");
    expect(expensePerson(99, members, "error").label).toBe(
      "멤버 정보 조회 실패",
    );
    expect(expensePerson(2, members, "success").label).toContain("나간 멤버");
  });
  it("offers ACTIVE/LEFT plus selected historical IDs only in their original role", () => {
    expect(roleOptions(members, [99], [99]).map((x) => x.userId)).toEqual([
      1, 2, 99,
    ]);
    expect(roleOptions(members, [99], []).map((x) => x.userId)).toEqual([1, 2]);
    expect(roleOptions(members, [], [99]).map((x) => x.userId)).toEqual([1, 2]);
  });
  it("validates complete payload without recomputing or trimming amount", () => {
    const check = (patch = {}) =>
      validateExpense({ ...body, ...patch }, [usd], members, undefined, []);
    expect(check()).toBeNull();
    expect(check({ payerUserIds: [1, 1] })).not.toBeNull();
    expect(check({ participantUserIds: [3] })).not.toBeNull();
    expect(check({ participantUserIds: [99] })).not.toBeNull();
    expect(check({ scheduleId: 10 })).not.toBeNull();
    expect(check({ expenseGroup: "TRIP_DAY" })).not.toBeNull();
    expect(check({ memo: "x".repeat(1001) })).not.toBeNull();
  });
  it("preserves original unknown role, rejects cross-role copying and wrong-day place", () => {
    const original = {
      ...body,
      id: 1,
      createdAt: "",
      updatedAt: "",
      payerUserIds: [99],
    };
    expect(validateExpense(original, [usd], members, original, [])).toBeNull();
    expect(
      validateExpense(
        { ...original, participantUserIds: [99] },
        [usd],
        members,
        original,
        [],
      ),
    ).not.toBeNull();
    const days = [{ scheduleId: 10, items: [{ itemId: 100 }] }];
    expect(
      validateExpense(
        {
          ...body,
          expenseGroup: "TRIP_DAY",
          scheduleId: 10,
          scheduleItemId: 100,
        },
        [usd],
        members,
        undefined,
        days,
      ),
    ).toBeNull();
    expect(
      validateExpense(
        {
          ...body,
          expenseGroup: "TRIP_DAY",
          scheduleId: 10,
          scheduleItemId: 101,
        },
        [usd],
        members,
        undefined,
        days,
      ),
    ).not.toBeNull();
  });
});

describe("approved expense categories", () => {
  it.each([
    "FLIGHT",
    "ACCOMMODATION",
    "FOOD",
    "TRANSPORT",
    "SHOPPING",
    "SIGHTSEEING",
    "OTHER",
  ])("accepts the exact category %s, including legacy OTHER", (category) => {
    expect(
      validateExpense(
        { ...body, category } as ExpenseInput,
        [usd],
        members,
        undefined,
        [],
      ),
    ).toBeNull();
  });
  it.each([
    undefined,
    null,
    "",
    "flight",
    "항공",
    " FLIGHT",
    "FLIGHT ",
    "ENTERTAINMENT",
    "0",
    "1",
    0,
    1,
    [],
    {},
  ])("rejects invalid category %j without normalization", (category) => {
    expect(
      validateExpense(
        { ...body, category } as ExpenseInput,
        [usd],
        members,
        undefined,
        [],
      ),
    ).not.toBeNull();
  });
});
