"use client";
import { ExpenseKrwAmount } from "./ExpenseKrw";
import { useId, useState } from "react";
import { ChevronDownIcon } from "@/assets/icons";
import {
  expenseCategories,
  expenseCategoryLabel,
} from "@/lib/api/rooms/expenses";
import { totalsByCurrency } from "@/lib/expenses/expense-scope";
import { useExpenseContext } from "./ExpenseProvider";
import { CategoryIcon, formatExpenseAmount } from "./ExpenseViews";

export function ExpenseCategorySummary() {
  const { list, krwSummary } = useExpenseContext();
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const rows = expenseCategories
    .map(({ value }) => ({
      category: value,
      expenses: (list.data ?? []).filter((e) => e.category === value),
    }))
    .filter((row) => row.expenses.length);
  return (
    <section className="mt-4 border-t border-border-subtle pt-4">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-2 text-body-s-emphasis @min-[800px]/expenses:pointer-events-none @min-[800px]/expenses:hidden"
      >
        카테고리별 비용 요약{" "}
        <span className="flex items-center gap-1 text-body-xs-regular text-text-subtle">
          {expanded ? "접기" : "펼치기"}
          <ChevronDownIcon size={16} className={expanded ? "rotate-180" : ""} />
        </span>
      </button>
      <h3 className="hidden items-center justify-between text-body-s-emphasis @min-[800px]/expenses:flex">
        카테고리별 지출{" "}
        <span className="text-body-xs-regular text-text-subtle">
          전체 {list.data?.length ?? 0}건
        </span>
      </h3>
      <div
        id={id}
        className={`${expanded ? "block" : "hidden"} @min-[800px]/expenses:block`}
      >
        {list.isPending && (
          <p
            role="status"
            className="py-3 text-body-xs-regular text-text-subtle"
          >
            비용 요약을 불러오는 중…
          </p>
        )}
        {list.isSuccess && !rows.length && (
          <p className="py-3 text-body-xs-regular text-text-subtle">
            등록된 비용이 없어요.
          </p>
        )}
        <dl className="mt-3 space-y-4">
          {rows.map(({ category, expenses }) => (
            <div key={category} className="flex items-center gap-2">
              <dt className="flex min-w-0 flex-1 items-center gap-2 text-body-xs-regular">
                <CategoryIcon category={category} />
                <span>
                  {expenseCategoryLabel(category)}
                  <span className="block text-text-subtle">
                    {expenses.length}건
                  </span>
                </span>
              </dt>
              <dd className="min-w-0 max-w-[60%] text-right text-body-xs-emphasis tabular-nums">
                <ExpenseKrwAmount total={krwSummary?.isSuccess && !krwSummary.isFetching ? krwSummary.data?.categories?.find((row) => row.category === category)?.total : undefined} />
                {totalsByCurrency(expenses).map((total) => (
                  <p key={total.currency} className="break-all">
                    {formatExpenseAmount(total.amount)} {total.currency}
                  </p>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
