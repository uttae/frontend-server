"use client";

import { ExpenseSelect } from "./ExpenseSelect";
import { useRef, useState } from "react";
import type { Expense } from "@/lib/api/rooms/expenses";
import { Plus, RefreshCw, ReceiptText, Users } from "lucide-react";
import { useExpenseContext } from "./ExpenseProvider";
import {
  ExpenseList,
  ExpenseSummaryView,
  expenseButtonClass,
  formatExpenseAmount,
} from "./ExpenseViews";
export function ExpensePanel() {
  const context = useExpenseContext();
  const [tab, setTab] = useState<"list" | "summary">("list");
  const [filter, setFilter] = useState("ALL");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const lock = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const activeFilter =
    filter === "ALL" ||
    filter === "PREPARATION" ||
    context.schedules.some((s) => String(s.scheduleId) === filter)
      ? filter
      : "ALL";
  const filtered =
    context.list.data?.filter(
      (e) =>
        activeFilter === "ALL" ||
        (activeFilter === "PREPARATION"
          ? e.expenseGroup === "PREPARATION"
          : e.expenseGroup === "TRIP_DAY" &&
            String(e.scheduleId) === activeFilter),
    ) ?? [];
  async function remove(expense: Expense) {
    if (lock.current || context.busy || !context.canManage) return;
    if (!confirm("이 지출을 삭제할까요? 정산 요약에도 반영돼요.")) return;
    lock.current = true;
    setDeleting(true);
    setError("");
    try {
      await context.remove(expense);
    } catch (e) {
      setError(e instanceof Error ? e.message : "지출 삭제에 실패했어요.");
    } finally {
      lock.current = false;
      setDeleting(false);
    }
  }
  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    setError("");
    try {
      await context.refresh();
    } catch {
      setError("새로고침에 실패했어요.");
    } finally {
      setRefreshing(false);
    }
  }
  const query = tab === "list" ? context.list : context.summary;
  return (
    <section
      aria-label="지출 및 정산"
      className="@container/expenses min-w-0 space-y-5 rounded-2xl border border-gray-border bg-white p-4 @min-[600px]/plan:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">지출 및 정산</h2>
          <p className="mt-1 text-sm text-dark-gray">
            함께 쓴 여행 경비를 한눈에 확인해요.
          </p>
        </div>
        {context.canManage && (
          <button
            type="button"
            aria-label="지출 추가"
            disabled={context.busy}
            onClick={() =>
              context.open(
                activeFilter !== "ALL" && activeFilter !== "PREPARATION"
                  ? { scheduleId: Number(activeFilter) }
                  : {},
              )
            }
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white cursor-pointer transition-colors enabled:hover:bg-primary-strong disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
          >
            <Plus size={17} aria-hidden="true" />
            지출 추가
          </button>
        )}
      </div>
      <div className="rounded-2xl bg-gray-50 p-4 @min-[480px]/expenses:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-dark-gray">여행 전체 지출</p>
            {context.summary.isPending && (
              <p role="status" className="mt-2 text-sm text-dark-gray">
                총액을 불러오는 중…
              </p>
            )}
            {context.summary.isError && (
              <p role="alert" className="mt-2 text-sm text-status-negative">
                총액을 불러오지 못했어요. 새로고침해 주세요.
              </p>
            )}
            {context.summary.isSuccess && (
              <div className="mt-2 flex flex-wrap gap-x-7 gap-y-2">
                {context.summary.data.currencies.length ? (
                  context.summary.data.currencies.map((c) => (
                    <p
                      key={c.currency}
                      className="min-w-0 break-all text-3xl font-bold tracking-tight tabular-nums"
                    >
                      {formatExpenseAmount(c.totalAmount)}{" "}
                      <span className="text-sm font-medium tracking-normal text-dark-gray">
                        {c.currency}
                      </span>
                    </p>
                  ))
                ) : (
                  <p className="text-lg font-semibold">
                    첫 지출을 기록해 보세요
                  </p>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label={refreshing ? "새로고침 중" : "새로고침"}
            title="새로고침"
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-dark-gray cursor-pointer transition-colors enabled:hover:bg-white enabled:hover:text-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
            disabled={refreshing || context.busy}
            onClick={() => void refresh()}
          >
            <RefreshCw
              size={17}
              aria-hidden="true"
              className={refreshing ? "motion-safe:animate-spin" : ""}
            />
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="지출 보기">
          <button
            type="button"
            aria-pressed={tab === "list"}
            className={`${expenseButtonClass} inline-flex items-center gap-2 ${tab === "list" ? "bg-white text-primary-strong shadow-sm" : "border-transparent text-dark-gray"}`}
            onClick={() => setTab("list")}
          >
            <ReceiptText size={16} aria-hidden="true" />
            지출 목록
          </button>
          <button
            type="button"
            aria-pressed={tab === "summary"}
            className={`${expenseButtonClass} inline-flex items-center gap-2 ${tab === "summary" ? "bg-white text-primary-strong shadow-sm" : "border-transparent text-dark-gray"}`}
            onClick={() => setTab("summary")}
          >
            <Users size={16} aria-hidden="true" />
            정산 요약
          </button>
        </div>
        {context.summary.data && context.summary.data.currencies.length > 1 && (
          <p className="mt-3 text-xs text-dark-gray">통화별로 따로 정산해요.</p>
        )}
      </div>
      {context.memberStatus !== "success" && (
        <p role="status" className="text-sm text-dark-gray">
          {context.memberStatus === "pending"
            ? "멤버 확인 중…"
            : "멤버 정보 조회 실패. 새로고침으로 다시 시도해 주세요."}{" "}
          지출의 사용자 ID와 금액은 유지돼요.
        </p>
      )}
      {context.memberStatus === "success" && !context.canManage && (
        <p role="alert" className="text-sm text-status-negative">
          현재 참여 중인 방장과 멤버만 지출에 접근할 수 있어요.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-status-negative">
          {error}
        </p>
      )}
      {query.isPending && (
        <p role="status" className="py-4 text-dark-gray">
          {tab === "list" ? "지출" : "정산"}을 불러오는 중…
        </p>
      )}
      {query.isError && (
        <p role="alert" className="text-sm text-status-negative">
          {query.error instanceof Error
            ? query.error.message
            : "조회에 실패했어요."}{" "}
          새로고침으로 다시 시도해 주세요.
        </p>
      )}
      {tab === "list" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-bold">
              지출 내역{" "}
              <span className="ml-1 text-sm font-medium text-dark-gray">
                {context.list.isSuccess ? `${filtered.length}건` : ""}
              </span>
            </h3>
            <div className="w-36 max-w-full">
              <ExpenseSelect
                label="준비·일차 필터"
                value={activeFilter}
                onChange={setFilter}
                options={[
                  { value: "ALL", label: "전체 지출" },
                  { value: "PREPARATION", label: "여행 준비" },
                  ...context.schedules.map((s) => ({
                    value: String(s.scheduleId),
                    label: `${s.dayNumber}일차`,
                  })),
                ]}
              />
            </div>
          </div>
          {context.list.isSuccess && (
            <ExpenseList
              expenses={filtered}
              members={context.members}
              memberStatus={context.memberStatus}
              schedules={context.schedules}
              canManage={context.canManage}
              onEdit={(expense) => context.open({ expense })}
              onDelete={(expense) => void remove(expense)}
              busy={context.busy || deleting}
            />
          )}
        </>
      )}
      {tab === "summary" && context.summary.isSuccess && (
        <ExpenseSummaryView
          summary={context.summary.data}
          members={context.members}
          memberStatus={context.memberStatus}
          schedules={context.schedules}
        />
      )}
    </section>
  );
}
