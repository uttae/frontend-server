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
 * 칸 규칙과 교차 규칙을 한 스키마에 두고 폼 validators 하나로 검사한다. 칸에 따로 validator를 두면
 * TanStack 제출이 칸 검사에서 멈춰 폼 검사(교차 규칙)가 돌지 않으므로, 첫 저장에 모든 칸 오류가 함께 보이도록 한 곳에서 본다
 */
const expenseNameSchema = z
  .string()
  .nullish()
  .superRefine((name, ctx) => {
    const message = expenseNameError(name);
    if (message) ctx.addIssue({ code: "custom", message });
  });

// 새 비용은 카테고리를 고르기 전까지 빈 값이다
const expenseCategorySchema = z.custom<ExpenseCategory | "">().superRefine((category, ctx) => {
  const message = expenseCategoryError(category);
  if (message) ctx.addIssue({ code: "custom", message });
});

const expenseMemoSchema = z
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

/** 오류는 화면의 칸(form.Field name)에 붙도록, 교차 규칙은 금액·연결 장소·결제자 칸을 path로 준다 */
export function createExpenseFormSchema({ currencies, members, original, daysOf }: ExpenseFormContext) {
  return z
    .object({
      expenseGroup: z.enum(["PREPARATION", "TRIP_DAY"]),
      scheduleId: z.number().nullable(),
      scheduleItemId: z.number().nullable(),
      totalAmount: z.string(),
      currency: z.string(),
      category: expenseCategorySchema,
      name: expenseNameSchema,
      memo: expenseMemoSchema,
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

export const EXPENSE_BUDGET_INVALID_MESSAGE =
  "예산은 1~15자리 숫자로 입력해 주세요. 음수·소수점·공백은 사용할 수 없어요." as const;

/** 공유 예산(KRW) 칸. 정수 1~15자리만 받는다 */
export const expenseBudgetSchema = z.string().regex(/^\d{1,15}$/, EXPENSE_BUDGET_INVALID_MESSAGE);
