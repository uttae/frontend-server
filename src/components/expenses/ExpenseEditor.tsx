"use client";

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
          payerUserIds: [],
          participantUserIds: [],
        },
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submitLock = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const currencyListId = useId();
  const errorId = useId();
  const places = useSchedulePlanPlaces(context.roomId, body.scheduleId);
  useEffect(() => {
    const element = dialog.current;
    const opener = element?.ownerDocument.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (opener && opener instanceof HTMLElement && opener.isConnected) opener.focus();
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
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-3xl border-0 bg-white p-5 text-black shadow-xl backdrop:bg-black/40"
    >
      <form
        onSubmit={submit}
        noValidate
        className="space-y-4"
        aria-describedby={error ? errorId : undefined}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-xl font-bold">
            {original ? "지출 수정" : "지출 추가"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className={expenseButtonClass}
          >
            닫기
          </button>
        </div>
        <p className="text-sm text-dark-gray">
          결제자와 부담자를 각각 균등하게 나눠요.
        </p>
        <fieldset disabled={pending} className="min-w-0 space-y-4">
          <label className="block text-sm font-semibold">
            지출 구분
            <select
              className={expenseInputClass}
              value={
                body.expenseGroup === "PREPARATION"
                  ? "PREPARATION"
                  : String(body.scheduleId)
              }
              onChange={(e) => {
                setBody((prev) => ({
                  ...prev,
                  expenseGroup:
                    e.target.value === "PREPARATION"
                      ? "PREPARATION"
                      : "TRIP_DAY",
                  scheduleId:
                    e.target.value === "PREPARATION"
                      ? null
                      : Number(e.target.value),
                  scheduleItemId: null,
                }));
                setError("");
              }}
            >
              <option value="PREPARATION">여행 준비</option>
              {context.schedules.map((s) => (
                <option key={s.scheduleId} value={s.scheduleId}>
                  {s.dayNumber}일차
                </option>
              ))}
            </select>
          </label>
          {body.expenseGroup === "TRIP_DAY" && (
            <label className="block text-sm font-semibold">
              연결 장소 (선택)
              <select
                className={expenseInputClass}
                value={body.scheduleItemId ?? ""}
                onChange={(e) =>
                  change(
                    "scheduleItemId",
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
                disabled={!places.isSuccess}
              >
                <option value="">장소 연결 없음</option>
                {places.data
                  ?.filter((p) => p.itemId !== undefined)
                  .map((p) => (
                    <option key={p.itemId} value={p.itemId}>
                      {p.title}
                    </option>
                  ))}
              </select>
              {!places.isSuccess && (
                <span className="text-sm text-dark-gray">
                  {places.isError
                    ? "장소 조회에 실패했어요. 새로고침 후 다시 시도해 주세요."
                    : "장소 확인 중…"}
                </span>
              )}
            </label>
          )}
          <label className="block text-sm font-semibold">
            카테고리
            <select
              name="category"
              required
              className={expenseInputClass}
              value={body.category}
              onChange={(e) => {
                if (isExpenseCategory(e.target.value))
                  change("category", e.target.value);
              }}
            >
              <option value="" disabled>
                카테고리 선택
              </option>
              {expenseCategories.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid min-w-0 gap-3 sm:grid-cols-[1fr_2fr]">
            <label className="block min-w-0 text-sm font-semibold">
              통화 검색
              <input
                className={expenseInputClass}
                list={currencyListId}
                value={body.currency}
                onChange={(e) =>
                  change("currency", e.target.value.toUpperCase())
                }
                placeholder="통화 코드 검색"
                autoComplete="off"
              />
              <datalist id={currencyListId}>
                {context.currencies.data?.map((c) => (
                  <option key={c.currency} value={c.currency}>
                    소수 {c.fractionDigits}자리
                  </option>
                ))}
              </datalist>
            </label>
            <label className="block min-w-0 text-sm font-semibold">
              금액
              <input
                className={expenseInputClass}
                inputMode="decimal"
                value={body.totalAmount}
                onChange={(e) => change("totalAmount", e.target.value)}
                placeholder={
                  currency
                    ? currency.fractionDigits
                      ? `0.${"0".repeat(currency.fractionDigits)}`
                      : "0"
                    : "금액"
                }
                autoComplete="off"
              />
            </label>
          </div>
          {currency && (
            <p className="break-all text-xs text-dark-gray">
              소수 {currency.fractionDigits}자리 · 최대 {currency.maximumAmount}{" "}
              {currency.currency}. 입력 금액을 반올림하거나 환전하지 않아요.
            </p>
          )}
          {!context.currencies.isSuccess && (
            <p role="status" className="text-sm text-dark-gray">
              {context.currencies.isError
                ? "통화 목록 조회에 실패했어요."
                : "통화 목록을 불러오는 중…"}
            </p>
          )}
          {context.memberStatus === "success" ? (
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <ExpenseRolePicker
                title="결제자"
                members={context.members}
                selected={body.payerUserIds}
                original={original?.payerUserIds ?? []}
                onChange={(ids) => change("payerUserIds", ids)}
              />
              <ExpenseRolePicker
                title="부담자"
                members={context.members}
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
        <div className="flex flex-wrap justify-end gap-2">
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
            className={`${expenseButtonClass} bg-primary text-white hover:bg-primary-strong`}
            disabled={!ready || pending}
          >
            {pending ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
