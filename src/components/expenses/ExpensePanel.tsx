"use client";
import { cn } from "@/lib/utils";
import { expenseTitle } from "@/lib/expenses/expense-name";

import { MainPageHeader } from "@/components/layout/MainPageHeader";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { ExpenseBudgetSummary } from "./ExpenseBudgetSummary";
import { ExpenseSelect } from "./ExpenseSelect";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ExpenseApiError, type Expense } from "@/lib/api/rooms/expenses";
import { ExpenseKrwAmount, ExpenseRateNote } from "./ExpenseKrw";
import type { ExpenseKrwFilters } from "@/lib/api/rooms/expenses";
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
  const [tab, setTab] = useState<"list" | "summary">("list");
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
  const krwFilters = useMemo<ExpenseKrwFilters>(() => ({
    ...(category === "ALL" ? {} : { category: category as Expense["category"] }),
    ...(activeFilter === "ALL" ? {} : activeFilter === "PREPARATION"
      ? { expenseGroup: "PREPARATION" as const }
      : { expenseGroup: "TRIP_DAY" as const, scheduleId: Number(activeFilter) }),
  }), [category, activeFilter]);
  const { setKrwFilters } = context;
  useEffect(() => { setKrwFilters?.(krwFilters); }, [setKrwFilters, krwFilters]);
  const detailed = JSON.stringify(context.krwFilters) === JSON.stringify(krwFilters)
    && context.syncStatus === "ready" && context.filteredKrwSummary?.isSuccess && !context.filteredKrwSummary.isFetching
    ? context.filteredKrwSummary.data : undefined;
  const wholeKrw = context.syncStatus === "ready" && context.krwSummary.isSuccess && !context.krwSummary.isFetching
    ? context.krwSummary.data : undefined;
  // Reuse authoritative totals for a single dimension; never sum rounded row amounts
  // or show the previous day/category total while a new intersection is loading.
  const fallbackTotal = activeFilter === "ALL"
    ? category === "ALL" ? wholeKrw : wholeKrw?.categories?.find(row => row.category === category)?.total
    : category === "ALL" ? wholeKrw?.days?.find(day => activeFilter === "PREPARATION"
      ? day.expenseGroup === "PREPARATION"
      : day.expenseGroup === "TRIP_DAY" && String(day.scheduleId) === activeFilter)?.total : undefined;
  const selectedTotal = detailed?.filtered ?? fallbackTotal;
  const visibleExpenses = detailed?.expenses?.map((row) => row.expense) ?? filtered;
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
    [context.list, context.summary, context.budget, context.krwSummary, context.filteredKrwSummary].filter(Boolean).some(
      (query) => query?.isError,
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
        className="mb-6 min-h-[72px] items-center mobile:hidden max-sm:hidden [&_h1]:text-[32px] [&_h1]:leading-[42px]"
        action={
          <div className="flex gap-3 [&>button]:h-9 [&>button]:min-h-9 [&>button]:min-w-[111px] [&>button]:rounded-full [&>button]:py-0 [&>button]:text-[14px]">
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
      {context.syncStatus !== "ready" && (
        <output
          style={{ display: "block" }}
          className="mb-4 text-body-xs-regular text-dark-gray"
        >
          {syncStatusMessage(context.syncStatus)}
        </output>
      )}
      <div className="grid min-w-0 gap-4 @min-[800px]/expenses:gap-6 @min-[800px]/expenses:grid-cols-[minmax(260px,26%)_minmax(0,1fr)]">
        <aside className="min-w-0 self-stretch rounded-xl border border-border-subtle bg-white p-4 @min-[800px]/expenses:min-h-[calc(100dvh-216px)] @min-[800px]/expenses:p-6">
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
          <div className="hidden grid-cols-2 gap-4 mobile:grid max-sm:grid [&>button]:h-11 [&>button]:bg-fill-subtle [&>button:first-child]:bg-primary [&_svg]:hidden">
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
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_152px] items-center gap-x-3 gap-y-4 @min-[800px]/expenses:grid-cols-[minmax(0,1fr)_180px]">
            <div
              aria-label="준비·일차 필터"
              className="col-span-2 flex min-h-12 min-w-0 max-w-full items-center gap-2 overflow-x-auto [scrollbar-width:none] @min-[800px]/expenses:col-span-1"
            >
              {dayOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-label={`${option.label} 비용`}
                  aria-pressed={activeFilter === option.value}
                  onClick={() => setFilter(option.value)}
                  className={`h-9 shrink-0 cursor-pointer rounded-full border px-4 text-[14px] font-medium leading-5 focus-visible:outline-2 focus-visible:outline-primary ${activeFilter === option.value ? "border-border text-primary" : "border-border text-text-disabled hover:bg-fill"}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="col-start-2 row-start-2 w-full @min-[800px]/expenses:row-start-1">
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
                <ExpenseKrwAmount total={selectedTotal} />
                {!selectedTotal && totalsByCurrency(filtered).map((total) => (
                  <span key={total.currency} className="break-all">
                    {formatExpenseAmount(total.amount)} {total.currency}
                  </span>
                ))}
                <span className="text-body-xs-regular text-text-subtle">
                  {visibleExpenses.length}건
                </span>
              </div>
            )}
          </div>
          {context.filteredKrwSummary?.isError && <p role="alert">선택한 비용의 원화 조회에 실패했어요. 조회 다시 시도 버튼을 눌러 주세요.</p>}
          {context.list.isSuccess && (
            <>
              <ExpenseList
                roomId={context.roomId}
                expenses={visibleExpenses}
                krwSummary={detailed ?? (category === "ALL" ? wholeKrw : undefined)}
                rowKrwSummary={detailed ?? wholeKrw}
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
                <div className="text-body-xs-regular text-text-subtle">
                  <p className="hidden @min-[800px]/expenses:block">
                    선택한 일정의 지출만 표시해요. 여행 전체 예산과 정산은 전체 기준이에요.
                  </p>
                  <p className="@min-[800px]/expenses:hidden">
                    {activeFilter !== "ALL" && dayOptions.find(option => option.value === activeFilter)?.label}
                    {activeFilter !== "ALL" && category !== "ALL" && " · "}
                    {category !== "ALL" && expenseCategoryLabel(category as Expense["category"])}{" "}
                    지출만 표시해요.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <details className="mt-6 text-body-xs-regular text-text-subtle">
        <summary className="cursor-pointer">환율 정보</summary>
        <ExpenseRateNote summary={context.krwSummary.data} />
      </details>
      {tab !== "list" && (
        <ExpenseDialog
          title="정산 요약"
          description={context.summary.data ? `전체 여행 · ${new Set(context.summary.data.currencies.flatMap(currency => currency.individuals.map(person => person.userId))).size}명` : undefined}
          onClose={() => setTab("list")}
          settlement
          footer={
            <div className="flex justify-end">
              <button
                type="button"
                className={cn(expenseButtonClass, "min-h-9 min-w-[111px] rounded-full bg-primary py-1 text-white mobile:h-12 mobile:min-h-12 mobile:w-full mobile:rounded-lg mobile:text-[16px] mobile:font-bold max-sm:h-12 max-sm:min-h-12 max-sm:w-full max-sm:rounded-lg max-sm:text-[16px] max-sm:font-bold")}
                onClick={() => setTab("list")}
              >
                확인
              </button>
            </div>
          }
        >
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
            (
              <ExpenseSummaryView
                currentUserId={context.currentUserId}
                krwSummary={context.krwSummary.isSuccess && !context.krwSummary.isFetching ? context.krwSummary.data : undefined}
                scope="all"
                showDetails={false}
                summary={context.summary.data}
                members={context.members}
                memberStatus={context.memberStatus}
              />
            )}
        </ExpenseDialog>
      )}
      {expenseToDelete ? (
        <ConfirmDialog
          title="비용을 삭제할까요?"
          appearance="ledger"
          destructive
          description={`${expenseTitle(expenseToDelete)} 내역을 삭제해요. 삭제한 내역은 복구할 수 없어요.`}
          confirmLabel="삭제"
          isPending={deleting}
          onConfirm={() => void confirmRemove()}
          onCancel={() => setExpenseToDelete(null)}
        />
      ) : null}
    </section>
  );
}
