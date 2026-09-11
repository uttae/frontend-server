"use client";

import { cn } from "@/lib/utils";
import { ExpenseSelect } from "./ExpenseSelect";
import { ExpenseCurrencyPicker } from "./ExpenseCurrencyPicker";
import { ExpenseAmountInput } from "./ExpenseAmountInput";
import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  expenseCategories,
  isExpenseCategory,
  type Expense,
  type ExpenseInput,
} from "@/lib/api/rooms/expenses";
import { validateExpense } from "@/lib/expenses/expense-policy";
import { useSchedulePlanPlaces } from "@/hooks/useRooms";
import { useExpenseContext } from "./ExpenseProvider";
import {
  ExpenseRolePicker,
  expenseButtonClass,
  expenseInputClass,
} from "./ExpenseViews";
export type ExpenseEntry = {
  expense?: Expense;
  scheduleId?: number;
  scheduleItemId?: number;
};

export function ExpenseEditor({
  initial,
  onClose,
}: {
  initial: ExpenseEntry;
  onClose: () => void;
}) {
  const context = useExpenseContext();
  const original = initial.expense;
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
    setError("");
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitLock.current || pending) return;
    if (!ready) {
      setError("멤버·통화·일차 정보를 확인한 뒤 다시 시도해 주세요.");
      return;
    }
    const category = body.category;
    if (!isExpenseCategory(category)) {
      setError("카테고리를 선택해 주세요.");
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
      setError(validation);
      return;
    }
    submitLock.current = true;
    setSaving(true);
    setError("");
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
      await context.save(payload, original?.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "지출을 저장하지 못했어요.");
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
      className="fixed inset-0 m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-3xl border-0 bg-white p-0 text-black shadow-xl backdrop:bg-black/40"
    >
      <form
        onSubmit={submit}
        noValidate
        className="@container/expense-editor space-y-5 p-5 sm:p-6"
        aria-describedby={error ? errorId : undefined}
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-border pb-4">
          <h2 id={titleId} className="text-xl font-bold">
            {original ? "지출 수정" : "지출 추가"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="닫기"
            className="flex size-10 items-center justify-center rounded-full bg-light-gray text-dark-gray cursor-pointer transition-colors enabled:hover:bg-gray-border enabled:hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <fieldset disabled={pending} className="min-w-0 space-y-4">
          <div className="grid min-w-0 grid-cols-1 @min-[440px]/expense-editor:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 rounded-2xl bg-light-gray/60 p-4">
            <ExpenseCurrencyPicker
              value={body.currency}
              currencies={context.currencies.data ?? []}
              disabled={pending || !context.currencies.isSuccess}
              onChange={(value) => change("currency", value)}
            />
            <label className="block min-w-0 text-sm font-semibold">
              <span className="block text-sm leading-5">금액</span>
              <ExpenseAmountInput
                value={body.totalAmount}
                fractionDigits={currency?.fractionDigits}
                onChange={(value) => change("totalAmount", value)}
                placeholder={
                  currency
                    ? currency.fractionDigits
                      ? `0.${"0".repeat(currency.fractionDigits)}`
                      : "0"
                    : "금액"
                }
              />
            </label>
          </div>
          {currency && (
            <p className="break-all text-xs text-dark-gray">
              {currency.fractionDigits === 0
                ? `${currency.currency} 금액은 입력을 마치면 소수점 아래를 버려요.`
                : `입력을 마치면 소수 ${currency.fractionDigits}자리에 맞춰 0을 채우거나 초과 자리를 버려요.`}
            </p>
          )}
          {!context.currencies.isSuccess && (
            <p role="status" className="text-sm text-dark-gray">
              {context.currencies.isError
                ? "통화 목록 조회에 실패했어요."
                : "통화 목록을 불러오는 중…"}
            </p>
          )}
          <div className="space-y-1">
            <p className="text-sm font-semibold">지출 구분</p>
            <ExpenseSelect
              label="지출 구분"
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
                setError("");
              }}
            />
          </div>
          {body.expenseGroup === "TRIP_DAY" && (
            <div className="space-y-1">
              <p className="text-sm font-semibold">연결 장소 (선택)</p>
              <ExpenseSelect
                label="연결 장소 (선택)"
                value={
                  body.scheduleItemId === null
                    ? ""
                    : String(body.scheduleItemId)
                }
                disabled={pending || !places.isSuccess}
                options={[
                  { value: "", label: "장소 연결 없음" },
                  ...(places.data ?? [])
                    .filter((p) => p.itemId !== undefined)
                    .map((p) => ({ value: String(p.itemId), label: p.title })),
                ]}
                onChange={(value) =>
                  change("scheduleItemId", value ? Number(value) : null)
                }
              />
              {!places.isSuccess && (
                <p className="text-sm text-dark-gray">
                  {places.isError
                    ? "장소 조회에 실패했어요. 새로고침 후 다시 시도해 주세요."
                    : "장소 확인 중…"}
                </p>
              )}
            </div>
          )}
          <div className="space-y-1">
            <p className="text-sm font-semibold">카테고리</p>
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
            <p role="status" className="text-sm text-dark-gray">
              {context.memberStatus === "error"
                ? "멤버 정보 조회 실패. 기존 선택은 유지되며 저장은 잠시 중단돼요."
                : "멤버 확인 중… 기존 선택은 유지돼요."}
            </p>
          )}
          <label className="block text-sm font-semibold">
            메모 (선택)
            <textarea
              className={expenseInputClass}
              rows={3}
              maxLength={1000}
              value={body.memo ?? ""}
              onChange={(e) => change("memo", e.target.value)}
            />
            <span className="text-xs text-dark-gray">
              {body.memo?.length ?? 0}/1000
            </span>
          </label>
        </fieldset>
        {!context.canManage && context.memberStatus === "success" && (
          <p role="alert">
            현재 참여 중인 방장과 멤버만 지출을 변경할 수 있어요.
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-sm text-status-negative">
            {error}
          </p>
        )}
        <div className="sticky -bottom-5 -mx-5 -mb-5 flex flex-wrap justify-end gap-2 border-t border-gray-border bg-white px-5 py-4 sm:-bottom-6 sm:-mx-6 sm:-mb-6 sm:px-6">
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
            disabled={!ready || pending}
          >
            {pending ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
