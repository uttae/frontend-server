"use client";

import { useRef, useState } from "react";
import type { Expense } from "@/lib/api/rooms/expenses";
import { ExpenseEntryButton, useExpenseContext } from "./ExpenseProvider";
import {
  ExpenseList,
  ExpenseSummaryView,
  expenseButtonClass,
  expenseInputClass,
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
      className="min-w-0 space-y-4 rounded-2xl border border-gray-border bg-white p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">지출 및 정산</h2>
        <button
          type="button"
          className={expenseButtonClass}
          disabled={refreshing || context.busy}
          onClick={() => void refresh()}
        >
          {refreshing ? "새로고침 중…" : "새로고침"}
        </button>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="지출 보기">
        <button
          type="button"
          aria-pressed={tab === "list"}
          className={`${expenseButtonClass} ${tab === "list" ? "bg-primary/10 text-primary-strong" : ""}`}
          onClick={() => setTab("list")}
        >
          지출 목록
        </button>
        <button
          type="button"
          aria-pressed={tab === "summary"}
          className={`${expenseButtonClass} ${tab === "summary" ? "bg-primary/10 text-primary-strong" : ""}`}
          onClick={() => setTab("summary")}
        >
          정산 요약
        </button>
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
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="min-w-0 text-sm font-semibold">
              준비·일차 필터
              <select
                className={expenseInputClass}
                value={activeFilter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="ALL">전체 지출</option>
                <option value="PREPARATION">여행 준비</option>
                {context.schedules.map((s) => (
                  <option key={s.scheduleId} value={s.scheduleId}>
                    {s.dayNumber}일차
                  </option>
                ))}
              </select>
            </label>
            <ExpenseEntryButton label="준비 지출 추가" />
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
