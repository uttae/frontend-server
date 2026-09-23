"use client";

import { cn } from "@/lib/utils";
import { ExpenseSelect } from "./ExpenseSelect";
import { ExpenseCurrencyPicker } from "./ExpenseCurrencyPicker";
import { ExpenseAmountInput } from "./ExpenseAmountInput";
import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  ExpenseApiError,
  expenseCategories,
  isExpenseCategory,
  type Expense,
  type ExpenseInput,
} from "@/lib/api/rooms/expenses";
import { validateExpense } from "@/lib/expenses/expense-policy";
import { useSchedulePlanPlaces } from "@/hooks/useRooms";
import { useExpenseContext } from "./ExpenseProvider";
import {
  ExpenseList,
  ExpenseRolePicker,
  expenseButtonClass,
  expenseInputClass,
} from "./ExpenseViews";
export type ExpenseEntry = {
  expense?: Expense;
  scheduleId?: number;
  scheduleItemId?: number;
};

function ExpenseEditorConflict({
  conflict,
  conflictMoved,
  pending,
  targetChanged,
  onContinue,
  onRecover,
}: Readonly<{
  conflict: { latest?: Expense; failed?: boolean };
  conflictMoved: boolean;
  pending: boolean;
  targetChanged: boolean;
  onContinue: () => void;
  onRecover: () => void;
}>) {
  const context = useExpenseContext();
  let message = "비용이 삭제되었어요. 입력 내용은 복사할 수 있어요.";
  if (pending) message = "최신 비용 확인 중…";
  else if (conflict.failed) message = "최신 비용 조회에 실패했어요. 저장은 중단돼요.";
  return (
    <div
      role="alert"
      className="space-y-3 rounded-xl border border-gray-border p-3"
    >
      <p>
        비용이 변경되었어요. 입력 내용은 유지돼요. 최신 비용을 확인해
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
          {conflictMoved ? (
            <p>
              연결 위치가 변경되었어요. 입력 내용을 복사한 뒤 최신
              비용을 다시 열어 주세요.
            </p>
          ) : (
            <button
              type="button"
              className={expenseButtonClass}
              disabled={pending || targetChanged}
              onClick={onContinue}
            >
              최신 비용 확인 후 수정 계속
            </button>
          )}
        </>
      ) : (
        <p>{message}</p>
      )}
      {conflict.failed && (
        <button
          type="button"
          className={expenseButtonClass}
          disabled={pending}
          onClick={onRecover}
        >
          최신 비용 다시 조회
        </button>
      )}
    </div>
  );
}

function amountPlaceholder(currency: { fractionDigits: number } | undefined) {
  if (!currency) return "금액";
  return currency.fractionDigits ? `0.${"0".repeat(currency.fractionDigits)}` : "0";
}

export function ExpenseEditor({
  initial,
  onClose,
}: {
  initial: ExpenseEntry;
  onClose: () => void;
}) {
  const context = useExpenseContext();
  // This snapshot advances only after the user reviews a conflict response.
  const [original, setOriginal] = useState(initial.expense);
  const [conflict, setConflict] = useState<{
    latest?: Expense;
    failed?: boolean;
  } | null>(null);
  const self =
    context.canManage &&
    context.members.some(
      (member) =>
        member.userId === context.currentUserId && member.status === "ACTIVE",
    )
      ? context.currentUserId
      : undefined;
  const [body, setBody] = useState<
    Omit<ExpenseInput, "category"> & { category: ExpenseInput["category"] | "" }
  >(() =>
    original
      ? { ...original }
      : {
          expenseGroup:
            initial.scheduleId === undefined ? "PREPARATION" : "TRIP_DAY",
          scheduleId: initial.scheduleId ?? null,
          scheduleItemId: initial.scheduleItemId ?? null,
          totalAmount: "",
          currency:
            context.currencies.data?.find((c) => c.currency === "KRW")
              ?.currency ??
            context.currencies.data?.[0]?.currency ??
            "",
          category: "",
          memo: "",
          payerUserIds: self === undefined ? [] : [self],
          participantUserIds: self === undefined ? [] : [self],
        },
  );
  const [error, setError] = useState("");
  const [errorOccurrence, setErrorOccurrence] = useState(0);
  const errorMessageRef = useRef<HTMLParagraphElement>(null);
  function reportError(message: string) {
    setError(message);
    if (message) setErrorOccurrence(count => count + 1);
  }
  useEffect(() => {
    if (!error) return;
    const reduceMotion = typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    errorMessageRef.current?.scrollIntoView({
      block: "nearest",
      behavior: reduceMotion ? "instant" : "smooth",
    });
  }, [error, errorOccurrence]);
  const [saving, setSaving] = useState(false);
  const submitLock = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const errorId = useId();
  const places = useSchedulePlanPlaces(context.roomId, body.scheduleId);
  useEffect(() => {
    const element = dialog.current;
    const opener = element?.ownerDocument.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (opener && opener instanceof HTMLElement && opener.isConnected)
        opener.focus();
    };
  }, []);
  const pending = saving || context.busy;
  const currentTarget = context.list?.data?.find(
    (e) => e.id === original?.id,
  );
  const targetChanged = Boolean(
    original &&
      context.list?.isSuccess &&
      (!currentTarget ||
        currentTarget.expenseGroup !== original.expenseGroup ||
        currentTarget.scheduleId !== original.scheduleId ||
        currentTarget.scheduleItemId !== original.scheduleItemId),
  );
  const conflictMoved = Boolean(
    conflict?.latest &&
      original &&
      (conflict.latest.expenseGroup !== original.expenseGroup ||
        conflict.latest.scheduleId !== original.scheduleId ||
        conflict.latest.scheduleItemId !== original.scheduleItemId),
  );
  async function recover() {
    if (!original) return;
    setConflict({});
    setSaving(true);
    try {
      setConflict({ latest: await context.readLatest(original.id) });
    } catch {
      setConflict({ failed: true });
    } finally {
      setSaving(false);
    }
  }
  const ready =
    context.canManage &&
    context.memberStatus === "success" &&
    context.currencies.isSuccess &&
    context.schedulesReady &&
    (body.expenseGroup === "PREPARATION" || places.isSuccess);
  const currency = context.currencies.data?.find(
    (c) => c.currency === body.currency,
  );
  function change<K extends keyof ExpenseInput>(
    key: K,
    value: ExpenseInput[K],
  ) {
    setBody((prev) => ({ ...prev, [key]: value }));
    reportError("");
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitLock.current || pending) return;
    if (conflict || targetChanged) return;
    if (!ready) {
      reportError("멤버·통화·일차 정보를 확인한 뒤 다시 시도해 주세요.");
      return;
    }
    const category = body.category;
    if (!isExpenseCategory(category)) {
      reportError("카테고리를 선택해 주세요.");
      return;
    }
    const days = context.schedules.map((s) => ({
      ...s,
      items:
        s.scheduleId === body.scheduleId
          ? (places.data ?? []).flatMap((p) =>
              p.itemId === undefined ? [] : [{ itemId: p.itemId }],
            )
          : [],
    }));
    const validation = validateExpense(
      { ...body, category },
      context.currencies.data ?? [],
      context.members,
      original,
      days,
    );
    if (validation) {
      reportError(validation);
      return;
    }
    submitLock.current = true;
    setSaving(true);
    reportError("");
    // Send only request fields, never id/timestamps from the original response.
    const payload: ExpenseInput = {
      expenseGroup: body.expenseGroup,
      scheduleId: body.scheduleId,
      scheduleItemId: body.scheduleItemId,
      totalAmount: body.totalAmount,
      currency: body.currency,
      category,
      memo: body.memo,
      payerUserIds: body.payerUserIds,
      participantUserIds: body.participantUserIds,
    };
    try {
      await context.save(payload, original?.id, original?.version);
      onClose();
    } catch (e) {
      if (
        e instanceof ExpenseApiError &&
        (e.code === "EXPENSE_CONFLICT" || e.code === "EXPENSE_NOT_FOUND")
      ) {
        await recover();
      }
      reportError(e instanceof Error ? e.message : "비용을 저장하지 못했어요.");
    } finally {
      submitLock.current = false;
      setSaving(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
      className="fixed inset-0 m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-3xl border-0 bg-white p-0 text-black shadow-xl backdrop:bg-black/40"
    >
      <form
        onSubmit={submit}
        noValidate
        className="@container/expense-editor flex max-h-[92dvh] min-h-0 flex-col overflow-hidden"
        aria-describedby={error ? errorId : undefined}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-border px-5 py-4 sm:px-6">
          <h2 id={titleId} className="text-title-m mobile:text-title-s font-bold">
            {original ? "비용 수정" : "비용 추가"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="닫기"
            className="flex size-10 items-center justify-center rounded-full text-dark-gray cursor-pointer transition-colors enabled:hover:bg-gray-50 enabled:hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-5 [scrollbar-gutter:stable] sm:p-6">
        <fieldset disabled={pending} className="min-w-0 space-y-4">
          <div className="grid min-w-0 grid-cols-1 @min-[440px]/expense-editor:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 rounded-2xl bg-gray-50 p-4">
            <ExpenseCurrencyPicker
              value={body.currency}
              currencies={context.currencies.data ?? []}
              disabled={pending || !context.currencies.isSuccess}
              onChange={(value) => change("currency", value)}
            />
            <label className="block min-w-0 text-label-m-emphasis mobile:text-label-s-emphasis font-semibold">
              <span className="block text-body-s-regular mobile:text-body-xs-regular leading-5">금액</span>
              <ExpenseAmountInput
                value={body.totalAmount}
                fractionDigits={currency?.fractionDigits}
                onChange={(value) => change("totalAmount", value)}
                placeholder={amountPlaceholder(currency)}
              />
            </label>
          </div>
          {!context.currencies.isSuccess && (
            <p role="status" className="text-body-s-regular mobile:text-body-xs-regular text-dark-gray">
              {context.currencies.isError
                ? "통화 목록 조회에 실패했어요."
                : "통화 목록을 불러오는 중…"}
            </p>
          )}
          <div className="space-y-1">
            <p className="text-body-s-emphasis mobile:text-body-xs-emphasis font-semibold">일차 구분</p>
            <ExpenseSelect
              label="일차 구분"
              disabled={pending}
              value={
                body.expenseGroup === "PREPARATION"
                  ? "PREPARATION"
                  : String(body.scheduleId)
              }
              options={[
                { value: "PREPARATION", label: "여행 준비" },
                ...context.schedules.map((s) => ({
                  value: String(s.scheduleId),
                  label: `${s.dayNumber}일차`,
                })),
              ]}
              onChange={(value) => {
                setBody((prev) => ({
                  ...prev,
                  expenseGroup:
                    value === "PREPARATION" ? "PREPARATION" : "TRIP_DAY",
                  scheduleId: value === "PREPARATION" ? null : Number(value),
                  scheduleItemId: null,
                }));
                reportError("");
              }}
            />
          </div>
          <div className="space-y-1">
            <p
              className={cn(
                "text-body-s-emphasis mobile:text-body-xs-emphasis font-semibold",
                body.expenseGroup === "PREPARATION" && "opacity-50",
              )}
            >
              연결 장소 (선택)
            </p>
            <ExpenseSelect
              label="연결 장소 (선택)"
              value={
                body.scheduleItemId === null
                  ? ""
                  : String(body.scheduleItemId)
              }
              disabled={pending || body.expenseGroup === "PREPARATION" || !places.isSuccess}
              options={[
                { value: "", label: "장소 연결 없음" },
                ...(body.expenseGroup === "TRIP_DAY" ? places.data ?? [] : [])
                  .filter((p) => p.itemId !== undefined)
                  .map((p) => ({ value: String(p.itemId), label: p.title })),
              ]}
              onChange={(value) =>
                change("scheduleItemId", value ? Number(value) : null)
              }
            />
            {body.expenseGroup === "TRIP_DAY" && !places.isSuccess && (
              <p className="text-body-s-regular mobile:text-body-xs-regular text-dark-gray">
                {places.isError
                  ? "장소 조회에 실패했어요. 새로고침 후 다시 시도해 주세요."
                  : "장소 확인 중…"}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-body-s-emphasis mobile:text-body-xs-emphasis font-semibold">카테고리</p>
            <ExpenseSelect
              name="category"
              label="카테고리"
              placeholder="카테고리 선택"
              disabled={pending}
              value={body.category}
              options={[...expenseCategories]}
              onChange={(value) => {
                if (isExpenseCategory(value)) change("category", value);
              }}
            />
          </div>
          {context.memberStatus === "success" ? (
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <ExpenseRolePicker
                title="결제자"
                members={context.members}
                currentUserId={context.currentUserId}
                selected={body.payerUserIds}
                original={original?.payerUserIds ?? []}
                onChange={(ids) => change("payerUserIds", ids)}
              />
              <ExpenseRolePicker
                title="부담자"
                members={context.members}
                currentUserId={context.currentUserId}
                selected={body.participantUserIds}
                original={original?.participantUserIds ?? []}
                onChange={(ids) => change("participantUserIds", ids)}
              />
            </div>
          ) : (
            <p role="status" className="text-body-s-regular mobile:text-body-xs-regular text-dark-gray">
              {context.memberStatus === "error"
                ? "멤버 정보 조회 실패. 기존 선택은 유지되며 저장은 잠시 중단돼요."
                : "멤버 확인 중… 기존 선택은 유지돼요."}
            </p>
          )}
          <label className="block text-label-m-emphasis mobile:text-label-s-emphasis font-semibold">
            메모 (선택)
            <textarea
              className={expenseInputClass}
              rows={3}
              maxLength={1000}
              value={body.memo ?? ""}
              onChange={(e) => change("memo", e.target.value)}
            />
            <span className="text-body-xs-regular text-dark-gray">
              {body.memo?.length ?? 0}/1000
            </span>
          </label>
        </fieldset>
        {!context.canManage && context.memberStatus === "success" && (
          <p role="alert">
            현재 참여 중인 방장과 멤버만 비용을 변경할 수 있어요.
          </p>
        )}
        {targetChanged && (
          <p role="alert">
            비용이 삭제되었거나 다른 위치로 이동했어요. 입력 내용을 복사한 뒤
            최신 비용을 다시 열어 주세요.
          </p>
        )}
        {conflict && (
          <ExpenseEditorConflict
            conflict={conflict}
            conflictMoved={conflictMoved}
            pending={pending}
            targetChanged={targetChanged}
            onContinue={() => {
              setOriginal(conflict.latest);
              setConflict(null);
              reportError("");
            }}
            onRecover={() => void recover()}
          />
        )}
        {error && (
          <p
            key={errorOccurrence}
            ref={errorMessageRef}
            id={errorId}
            role="alert"
            className="scroll-my-4 text-body-s-regular mobile:text-body-xs-regular text-status-negative"
          >
            {error}
          </p>
        )}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-gray-border bg-white px-5 py-4 sm:px-6">
          <button
            type="button"
            className={expenseButtonClass}
            disabled={pending}
            onClick={onClose}
          >
            취소
          </button>
          <button
            type="submit"
            className={cn(
              expenseButtonClass,
              "bg-primary text-white enabled:hover:bg-primary-strong",
            )}
            disabled={!ready || pending || Boolean(conflict) || targetChanged}
          >
            {pending ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
