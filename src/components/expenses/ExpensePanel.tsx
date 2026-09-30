"use client";

import { MainPageHeader } from "@/components/layout/MainPageHeader";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { ExpenseBudgetSummary } from "./ExpenseBudgetSummary";
import { ExpenseSelect } from "./ExpenseSelect";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ExpenseApiError, type Expense } from "@/lib/api/rooms/expenses";
import { RefreshCw } from "lucide-react";
import { PlusIcon } from "@/assets/icons";
import { ExpenseDialog } from "./ExpenseDialog";
import { ExpenseCategorySummary } from "./ExpenseCategorySummary";
import { totalsByCurrency } from "@/lib/expenses/expense-scope";
import {
  expenseCategories,
  expenseCategoryLabel,
} from "@/lib/api/rooms/expenses";
import { useExpenseContext } from "./ExpenseProvider";
import {
  ExpenseList,
  ExpenseSummaryView,
  ExpenseAnalysisView,
  expenseButtonClass,
  formatExpenseAmount,
} from "./ExpenseViews";
type DeleteConflict = { selected: Expense; latest?: Expense; failed?: boolean };

function ExpenseDeleteConflict({
  conflict,
  deleting,
  onRemove,
  onRecover,
  onCancel,
}: Readonly<{
  conflict: DeleteConflict;
  deleting: boolean;
  onRemove: (expense: Expense) => void;
  onRecover: (expense: Expense) => void;
  onCancel: () => void;
}>) {
  const context = useExpenseContext();
  let message = "이미 삭제된 비용이에요.";
  if (deleting) message = "최신 비용 확인 중…";
  else if (conflict.failed)
    message = "최신 비용 조회에 실패했어요. 삭제는 중단돼요.";
  return (
    <div
      role="alert"
      className="space-y-3 rounded-xl border border-gray-border p-3"
    >
      <p>
        삭제할 비용이 변경되었어요. 최신 비용을 확인한 뒤 삭제를 다시 확인해
        주세요.
      </p>
      {conflict.latest ? (
        <>
          <ExpenseList
            roomId={context.roomId}
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
            onClick={() => onRemove(conflict.latest!)}
          >
            최신 비용 확인 후 삭제
          </button>
        </>
      ) : (
        <p>{message}</p>
      )}
      {conflict.failed && (
        <button
          type="button"
          className={expenseButtonClass}
          disabled={deleting}
          onClick={() => onRecover(conflict.selected)}
        >
          최신 비용 다시 조회
        </button>
      )}
      <button
        type="button"
        className={expenseButtonClass}
        disabled={deleting || context.busy}
        onClick={onCancel}
      >
        삭제 취소
      </button>
    </div>
  );
}

function syncStatusMessage(status: string) {
  if (status === "disconnected")
    return "실시간 연결이 끊겼어요. 네트워크를 확인하고 연결 복구 안내에서 다시 시도해 주세요. 연결되면 최신 비용을 자동으로 확인해요.";
  if (status === "error")
    return "최신 상태 확인에 실패했어요. 이전 값은 최신 상태가 아닐 수 있어요. 조회 다시 시도 버튼을 눌러 주세요.";
  return "최신 비용 확인 중… 이전 값은 최신 상태가 아닐 수 있어요.";
}

export function ExpensePanel() {
  const context = useExpenseContext();
  const [tab, setTab] = useState<"list" | "summary" | "analysis">("list");
  const [settlementScope, setSettlementScope] = useState<"mine" | "all">("all");
  const [category, setCategory] = useState("ALL");
  const [filter, setFilter] = useState("ALL");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [conflict, setConflict] = useState<DeleteConflict | null>(null);
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
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
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
        (category === "ALL" || e.category === category) &&
        (activeFilter === "ALL" ||
          (activeFilter === "PREPARATION"
            ? e.expenseGroup === "PREPARATION"
            : e.expenseGroup === "TRIP_DAY" &&
              String(e.scheduleId) === activeFilter)),
    ) ?? [];
  function remove(expense: Expense, reviewed = false) {
    if (
      lock.current ||
      deleting ||
      context.busy ||
      !context.canManage ||
      (conflict && !reviewed)
    )
      return;
    setExpenseToDelete(expense);
  }
  // 실패 시 충돌 확인·에러 문구를 패널에 보여주므로 성공·실패와 무관하게 닫는다
  async function confirmRemove() {
    const expense = expenseToDelete;
    if (!expense || lock.current || deleting) return;
    lock.current = true;
    setDeleting(true);
    setError("");
    try {
      await context.remove(expense);
      setConflict(null);
      toast.success("비용을 삭제했어요.");
    } catch (e) {
      if (
        e instanceof ExpenseApiError &&
        (e.code === "EXPENSE_CONFLICT" || e.code === "EXPENSE_NOT_FOUND")
      )
        await recover(expense);
      setError(e instanceof Error ? e.message : "비용 삭제에 실패했어요.");
    } finally {
      lock.current = false;
      setDeleting(false);
      setExpenseToDelete(null);
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
  const query = context.list;
  const dayOptions = [
    { value: "ALL", label: "전체" },
    { value: "PREPARATION", label: "여행 준비" },
    ...context.schedules.map((s) => ({
      value: String(s.scheduleId),
      label: `Day ${s.dayNumber}`,
    })),
  ];
  const addButton = (
    <button
      type="button"
      aria-label="비용 추가"
      disabled={context.busy}
      onClick={() =>
        context.open(
          activeFilter !== "ALL" && activeFilter !== "PREPARATION"
            ? { scheduleId: Number(activeFilter) }
            : {},
        )
      }
      className={`${expenseButtonClass} inline-flex items-center justify-center gap-1 bg-primary text-white enabled:hover:bg-primary-strong`}
    >
      <PlusIcon size={16} />
      비용 추가
    </button>
  );
  if (context.revoked) return null;
  return (
    <section
      aria-label="비용 및 정산"
      className="@container/expenses min-w-0 text-body-s-regular"
    >
      <MainPageHeader
        title="가계부"
        description="여행 비용과 정산을 한눈에 확인해요."
        className="mb-6 mobile:hidden max-sm:hidden"
        action={
          <div className="flex gap-2 [&>button]:rounded-full">
            <button
              type="button"
              className={expenseButtonClass}
              onClick={() => setTab("summary")}
            >
              정산 요약
            </button>
            {context.canManage && addButton}
          </div>
        }
      />
      <h2 className="mb-4 hidden border-b-2 border-primary pb-3 text-center text-body-s-emphasis text-primary mobile:block max-sm:block">
        지출
      </h2>
      {context.syncStatus !== "ready" && (
        <output
          style={{ display: "block" }}
          className="mb-4 text-body-xs-regular text-dark-gray"
        >
          {syncStatusMessage(context.syncStatus)}
        </output>
      )}
      <div className="grid min-w-0 gap-5 @min-[800px]/expenses:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="min-w-0 self-stretch @min-[800px]/expenses:min-h-[65dvh] rounded-xl border border-border-subtle bg-white p-5">
          <ExpenseBudgetSummary />
          <ExpenseCategorySummary />
          {readFailed && (
            <button
              type="button"
              aria-label={refreshing ? "조회 다시 시도 중" : "조회 다시 시도"}
              className={`${expenseButtonClass} mt-4 inline-flex items-center gap-1`}
              disabled={refreshing || context.busy}
              onClick={() => void refresh()}
            >
              <RefreshCw size={16} aria-hidden />
              {refreshing ? "조회 다시 시도 중" : "조회 다시 시도"}
            </button>
          )}
        </aside>
        <div className="min-w-0 space-y-4">
          <div className="hidden grid-cols-2 gap-3 mobile:grid max-sm:grid">
            {context.canManage && addButton}
            <button
              type="button"
              className={expenseButtonClass}
              onClick={() => setTab("summary")}
            >
              정산 요약
            </button>
          </div>
          {context.memberStatus !== "success" && (
            <p
              role="status"
              className="text-body-s-regular mobile:text-body-xs-regular text-dark-gray"
            >
              {context.memberStatus === "pending"
                ? "멤버 확인 중…"
                : "멤버 정보 조회 실패. 조회 다시 시도 버튼을 눌러 주세요."}{" "}
              비용의 사용자 ID와 금액은 유지돼요.
            </p>
          )}
          {context.memberStatus === "success" && !context.canManage && (
            <p
              role="alert"
              className="text-body-s-regular mobile:text-body-xs-regular text-status-negative"
            >
              현재 참여 중인 방장과 멤버만 비용에 접근할 수 있어요.
            </p>
          )}
          {conflict && (
            <ExpenseDeleteConflict
              conflict={conflict}
              deleting={deleting}
              onRemove={(expense) => void remove(expense, true)}
              onRecover={(expense) => void recover(expense)}
              onCancel={() => {
                setConflict(null);
                setError("");
              }}
            />
          )}
          {error && (
            <p
              role="alert"
              className="text-body-s-regular mobile:text-body-xs-regular text-status-negative"
            >
              {error}
            </p>
          )}
          {query.isPending && (
            <p role="status" className="py-4 text-dark-gray">
              비용 목록을 불러오는 중…
            </p>
          )}
          {query.isError && (
            <p
              role="alert"
              className="text-body-s-regular mobile:text-body-xs-regular text-status-negative"
            >
              {query.error instanceof Error
                ? query.error.message
                : "조회에 실패했어요."}{" "}
              조회 다시 시도 버튼을 눌러 주세요.
            </p>
          )}
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_144px] items-center gap-3">
            <div
              aria-label="준비·일차 필터"
              className="col-span-2 flex min-w-0 max-w-full gap-1.5 overflow-x-auto pb-1 @min-[800px]/expenses:col-span-1"
            >
              {dayOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-label={`${option.label} 비용`}
                  aria-pressed={activeFilter === option.value}
                  onClick={() => setFilter(option.value)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-body-xs-regular focus-visible:outline-2 focus-visible:outline-primary ${activeFilter === option.value ? "border-primary/20 bg-primary/5 text-primary" : "border-border-subtle text-text-subtle hover:bg-fill"}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="col-start-2 row-start-2 w-36 @min-[800px]/expenses:row-start-1">
              <ExpenseSelect
                label="카테고리 필터"
                value={category}
                onChange={setCategory}
                mobileSheet
                options={[
                  { value: "ALL", label: "전체 카테고리" },
                  ...expenseCategories,
                ]}
              />
            </div>
            {context.list.isSuccess && (
              <div
                className="col-start-1 row-start-2 flex min-w-0 flex-wrap items-baseline gap-2 text-body-s-emphasis @min-[800px]/expenses:hidden"
                aria-label="선택한 비용 합계"
              >
                {totalsByCurrency(filtered).map((total) => (
                  <span key={total.currency} className="break-all">
                    {formatExpenseAmount(total.amount)} {total.currency}
                  </span>
                ))}
                <span className="text-body-xs-regular text-text-subtle">
                  {filtered.length}건
                </span>
              </div>
            )}
          </div>
          {context.list.isSuccess && (
            <>
              <ExpenseList
                roomId={context.roomId}
                expenses={filtered}
                members={context.members}
                memberStatus={context.memberStatus}
                schedules={context.schedules}
                canManage={context.canManage}
                onEdit={(expense) => context.open({ expense })}
                onDelete={(expense) => void remove(expense)}
                busy={context.busy || deleting || Boolean(conflict)}
                grouped
              />
              {(activeFilter !== "ALL" || category !== "ALL") && (
                <p className="text-body-xs-regular text-text-subtle">
                  {dayOptions.find((o) => o.value === activeFilter)?.label} ·{" "}
                  {category === "ALL"
                    ? "전체 카테고리"
                    : expenseCategoryLabel(
                        category as Expense["category"],
                      )}{" "}
                  지출만 표시해요. 여행 전체 예산과 정산은 전체 기준이에요.
                </p>
              )}
            </>
          )}
        </div>
      </div>
      {tab !== "list" && (
        <ExpenseDialog
          title={tab === "summary" ? "정산 요약" : "비용 분석"}
          onClose={() => setTab("list")}
          footer={
            <div className="flex justify-end">
              <button
                type="button"
                className={`${expenseButtonClass} min-w-24 bg-primary text-white mobile:w-full max-sm:w-full`}
                onClick={() => setTab("list")}
              >
                확인
              </button>
            </div>
          }
        >
          <div className="mb-4 flex gap-3 text-body-xs-regular">
            <button
              type="button"
              aria-pressed={tab === "summary"}
              onClick={() => setTab("summary")}
            >
              정산 요약
            </button>
            <button
              type="button"
              aria-pressed={tab === "analysis"}
              onClick={() => setTab("analysis")}
            >
              비용 분석
            </button>
          </div>
          {context.summary.isPending && (
            <p role="status">정산을 불러오는 중…</p>
          )}
          {context.summary.isError && (
            <div className="space-y-3">
              <p role="alert">정산 조회에 실패했어요.</p>
              <button
                type="button"
                className={expenseButtonClass}
                disabled={refreshing || context.busy}
                onClick={() => void refresh()}
              >
                {refreshing ? "조회 다시 시도 중" : "조회 다시 시도"}
              </button>
            </div>
          )}
          {context.summary.isSuccess &&
            (tab === "summary" ? (
              <ExpenseSummaryView
                currentUserId={context.currentUserId}
                scope={settlementScope}
                onScopeChange={setSettlementScope}
                summary={context.summary.data}
                members={context.members}
                memberStatus={context.memberStatus}
              />
            ) : (
              <ExpenseAnalysisView
                summary={context.summary.data}
                members={context.members}
                memberStatus={context.memberStatus}
                schedules={context.schedules}
              />
            ))}
        </ExpenseDialog>
      )}
      {expenseToDelete ? (
        <ConfirmDialog
          title="비용을 삭제할까요?"
          appearance="ledger"
          destructive
          description={`${expenseCategoryLabel(expenseToDelete.category)} 내역을 삭제해요. 삭제한 내역은 복구할 수 없어요.`}
          confirmLabel="삭제"
          isPending={deleting}
          onConfirm={() => void confirmRemove()}
          onCancel={() => setExpenseToDelete(null)}
        />
      ) : null}
    </section>
  );
}
