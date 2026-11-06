import { z } from "zod";

import type { Expense, ExpenseCategory, ExpenseCurrency } from "@/lib/api/rooms/expenses";
import type { RoomMember } from "@/lib/api/rooms/types";

import { expenseNameError } from "./expense-name";
import {
  amountError,
  expenseCategoryError,
  expenseLinkError,
  expenseMemoError,
  expenseRolesError,
  type ExpenseDay,
} from "./expense-policy";

/*
 * 비용 추가·수정 폼 스키마. 문구와 판정은 expense-name·expense-policy의 규칙 함수를 그대로 쓴다.
 * 칸 하나 규칙(제목·카테고리·메모)은 칸 스키마로 그 칸 validators에 두고,
 * 다른 값이나 서버 목록을 함께 봐야 하는 규칙(금액×통화, 일차×연결 장소, 결제자×부담자)은 폼 스키마에 둔다
 */
export const expenseNameSchema = z
  .string()
  .nullish()
  .superRefine((name, ctx) => {
    const message = expenseNameError(name);
    if (message) ctx.addIssue({ code: "custom", message });
  });

// 새 비용은 카테고리를 고르기 전까지 빈 값이다
export const expenseCategorySchema = z.custom<ExpenseCategory | "">().superRefine((category, ctx) => {
  const message = expenseCategoryError(category);
  if (message) ctx.addIssue({ code: "custom", message });
});

export const expenseMemoSchema = z
  .string()
  .nullable()
  .superRefine((memo, ctx) => {
    const message = expenseMemoError(memo);
    if (message) ctx.addIssue({ code: "custom", message });
  });

type ExpenseFormContext = {
  currencies: ExpenseCurrency[];
  members: RoomMember[];
  /** 수정 중인 원래 비용. 지금 멤버 목록에 없는 원래 결제자·부담자를 허용한다 */
  original: Expense | undefined;
  /** 일차 목록. 장소는 고른 일차의 것만 안다 */
  daysOf: (scheduleId: number | null) => ExpenseDay[];
};

/** 교차 규칙만 본다. 오류는 화면의 칸(form.Field name)에 붙도록 path를 금액·연결 장소·결제자 칸으로 둔다 */
export function createExpenseFormSchema({ currencies, members, original, daysOf }: ExpenseFormContext) {
  return z
    .object({
      expenseGroup: z.enum(["PREPARATION", "TRIP_DAY"]),
      scheduleId: z.number().nullable(),
      scheduleItemId: z.number().nullable(),
      totalAmount: z.string(),
      currency: z.string(),
      category: z.custom<ExpenseCategory | "">(),
      name: z.string().nullish(),
      memo: z.string().nullable(),
      payerUserIds: z.array(z.number()),
      participantUserIds: z.array(z.number()),
    })
    .superRefine((values, ctx) => {
      const amount = amountError(values.totalAmount, currencies.find((c) => c.currency === values.currency));
      if (amount) ctx.addIssue({ code: "custom", path: ["totalAmount"], message: amount });
      const link = expenseLinkError(values, daysOf(values.scheduleId));
      if (link) ctx.addIssue({ code: "custom", path: ["scheduleItemId"], message: link });
      // 결제자·부담자는 함께 검증하고 오류는 두 칸 아래 하나로 보인다
      const roles = expenseRolesError(values, members, original);
      if (roles) ctx.addIssue({ code: "custom", path: ["payerUserIds"], message: roles });
    });
}

/** 입력 중인 비용 폼 값 */
export type ExpenseFormValues = z.input<ReturnType<typeof createExpenseFormSchema>>;
