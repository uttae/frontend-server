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

const expenseNameSchema = z
  .string()
  .nullish()
  .superRefine((name, ctx) => {
    const message = expenseNameError(name);
    if (message) ctx.addIssue({ code: "custom", message });
  });

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
  original: Expense | undefined;
  daysOf: (scheduleId: number | null) => ExpenseDay[];
};

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
      const amount = amountError(
        values.totalAmount,
        currencies.find((c) => c.currency === values.currency),
      );
      if (amount) ctx.addIssue({ code: "custom", path: ["totalAmount"], message: amount });
      const link = expenseLinkError(values, daysOf(values.scheduleId));
      if (link) ctx.addIssue({ code: "custom", path: ["scheduleItemId"], message: link });
      const roles = expenseRolesError(values, members, original);
      if (roles) ctx.addIssue({ code: "custom", path: ["payerUserIds"], message: roles });
    });
}

export type ExpenseFormValues = z.input<ReturnType<typeof createExpenseFormSchema>>;

export const EXPENSE_BUDGET_INVALID_MESSAGE =
  "예산은 1~15자리 숫자로 입력해 주세요. 음수·소수점·공백은 사용할 수 없어요." as const;

export const expenseBudgetSchema = z.string().regex(/^\d{1,15}$/, EXPENSE_BUDGET_INVALID_MESSAGE);
