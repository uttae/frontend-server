"use client";

import { ExpenseBudgetSummary } from "./ExpenseBudgetSummary";
import { ExpenseSelect } from "./ExpenseSelect";
import { useRef, useState } from "react";
import { ExpenseApiError, type Expense } from "@/lib/api/rooms/expenses";
import { Plus, RefreshCw, ReceiptText, Users } from "lucide-react";
import { useExpenseContext } from "./ExpenseProvider";
import {
  ExpenseList,
  ExpenseSummaryView,
  expenseButtonClass,
} from "./ExpenseViews";
export function ExpensePanel() {
  const context = useExpenseContext();
  const [tab, setTab] = useState<"list" | "summary">("list");
  const [filter, setFilter] = useState("ALL");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [conflict, setConflict] = useState<{
    selected: Expense;
    latest?: Expense;
    failed?: boolean;
  } | null>(null);
  async function recover(selected: Expense) {
    setConflict({ selected });
    setDeleting(true);
    try {
      setConflict({
        selected,
        latest: await context.readLatest(selected.id),
      });
    } catch {
      setConflict({ selected, failed: true });
    } finally {
      setDeleting(false);
    }
  }
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
  async function remove(expense: Expense, reviewed = false) {
    if (
      lock.current ||
      deleting ||
      context.busy ||
      !context.canManage ||
      (conflict && !reviewed)
    )
      return;
    if (!confirm("이 지출을 삭제할까요? 정산 요약에도 반영돼요.")) return;
    lock.current = true;
    setDeleting(true);
    setError("");
    try {
      await context.remove(expense);
      setConflict(null);
    } catch (e) {
      if (
        e instanceof ExpenseApiError &&
        (e.code === "EXPENSE_CONFLICT" || e.code === "EXPENSE_NOT_FOUND")
      )
        await recover(expense);
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
      setError("조회 재시도에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setRefreshing(false);
    }
  }
  const readFailed =
    context.syncStatus === "error" ||
    context.memberStatus === "error" ||
    [context.list, context.summary, context.budget, context.krwSummary].some(
      (query) => query.isError,
    );
  const query = tab === "list" ? context.list : context.summary;
  if (context.revoked) return null;
  return (
    <section
      aria-label="지출 및 정산"
      className="@container/expenses min-w-0 space-y-5 rounded-2xl border border-gray-border bg-white p-4 @min-[600px]/plan:p-6"
    >
      {context.syncStatus !== "ready" && (
        <p role="status" className="text-sm text-dark-gray">
          {context.syncStatus === "disconnected"
            ? "실시간 연결이 끊겼어요. 네트워크를 확인하고 연결 복구 안내에서 다시 시도해 주세요. 연결되면 최신 지출을 자동으로 확인해요."
            : context.syncStatus === "error"
              ? "최신 상태 확인에 실패했어요. 이전 값은 최신 상태가 아닐 수 있어요. 조회 다시 시도 버튼을 눌러 주세요."
              : "최신 지출 확인 중… 이전 값은 최신 상태가 아닐 수 있어요."}
        </p>
      )}
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
            <ExpenseBudgetSummary />
          </div>
          {readFailed && (
            <button
              type="button"
              aria-label={refreshing ? "조회 다시 시도 중" : "조회 다시 시도"}
              className={`${expenseButtonClass} inline-flex shrink-0 items-center gap-1.5`}
              disabled={refreshing || context.busy}
              onClick={() => void refresh()}
            >
              <RefreshCw
                size={17}
                aria-hidden="true"
                className={refreshing ? "motion-safe:animate-spin" : ""}
              />
              {refreshing ? "조회 다시 시도 중" : "조회 다시 시도"}
            </button>
          )}
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
            : "멤버 정보 조회 실패. 조회 다시 시도 버튼을 눌러 주세요."}{" "}
          지출의 사용자 ID와 금액은 유지돼요.
        </p>
      )}
      {context.memberStatus === "success" && !context.canManage && (
        <p role="alert" className="text-sm text-status-negative">
          현재 참여 중인 방장과 멤버만 지출에 접근할 수 있어요.
        </p>
      )}
      {conflict && (
        <div
          role="alert"
          className="space-y-3 rounded-xl border border-gray-border p-3"
        >
          <p>
            삭제할 지출이 변경되었어요. 최신 지출을 확인한 뒤 삭제를 다시 확인해
            주세요.
          </p>
          {conflict.latest ? (
            <>
              <ExpenseList
                expenses={[conflict.latest]}
                members={context.members}
                memberStatus={context.memberStatus}
                schedules={context.schedules}
                canManage={false}
                onEdit={() => {}}
                onDelete={() => {}}
                busy={false}
              />
              <button
                type="button"
                className={expenseButtonClass}
                disabled={deleting || context.busy || !context.canManage}
                onClick={() => void remove(conflict.latest!, true)}
              >
                최신 지출 확인 후 삭제
              </button>
            </>
          ) : (
            <p>
              {deleting
                ? "최신 지출 확인 중…"
                : conflict.failed
                  ? "최신 지출 조회에 실패했어요. 삭제는 중단돼요."
                  : "이미 삭제된 지출이에요."}
            </p>
          )}
          {conflict.failed && (
            <button
              type="button"
              className={expenseButtonClass}
              disabled={deleting}
              onClick={() => void recover(conflict.selected)}
            >
              최신 지출 다시 조회
            </button>
          )}
          <button
            type="button"
            className={expenseButtonClass}
            disabled={deleting || context.busy}
            onClick={() => {
              setConflict(null);
              setError("");
            }}
          >
            삭제 취소
          </button>
        </div>
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
          조회 다시 시도 버튼을 눌러 주세요.
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
              busy={context.busy || deleting || Boolean(conflict)}
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
