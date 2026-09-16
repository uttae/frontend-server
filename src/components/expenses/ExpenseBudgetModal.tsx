"use client";

import { useCallback, useId, useRef, useState } from "react";
import {
  ExpenseApiError,
  type ExpenseBudget,
} from "@/lib/api/rooms/expenses";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import {
  SettingsActionButton,
  SettingsActionButtonRow,
} from "@/components/settings/SettingsActionButton";
import { ExpenseAmountInput } from "./ExpenseAmountInput";
import { useExpenseContext } from "./ExpenseProvider";
import {
  expenseButtonClass,
  expenseInputClass,
  formatExpenseAmount,
} from "./ExpenseViews";

export function ExpenseBudgetModal({
  initial,
  onClose,
}: Readonly<{
  initial: ExpenseBudget;
  onClose: () => void;
}>) {
  const context = useExpenseContext();
  const [opened] = useState(initial);
  const [draft, setDraft] = useState(initial.budgetKrw ?? "");
  const [version, setVersion] = useState(initial.version);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [conflict, setConflict] = useState<{
    latest?: ExpenseBudget;
    failed?: boolean;
  } | null>(null);
  const lock = useRef(false);
  const inputId = useId();
  const errorId = useId();
  // Stable callback keeps the shared dialog's focus scope intact while typing.
  const close = useCallback(() => {
    if (!lock.current) onClose();
  }, [onClose]);
  async function recover() {
    setConflict({});
    try {
      const latest = await context.readLatestBudget();
      setConflict({ latest });
    } catch {
      setConflict({ failed: true });
    }
  }
  async function reload() {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    try {
      await recover();
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  async function save() {
    if (lock.current || context.budgetBusy || !context.canManage || conflict)
      return;
    if (!/^\d{1,15}$/.test(draft)) {
      setError(
        "예산은 1~15자리 숫자로 입력해 주세요. 음수·소수점·공백은 사용할 수 없어요.",
      );
      return;
    }
    lock.current = true;
    setPending(true);
    setError("");
    try {
      await context.saveBudget({
        budgetKrw: draft,
        expectedVersion: version,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "예산 저장에 실패했어요.");
      if (
        e instanceof ExpenseApiError &&
        e.status === 409 &&
        e.code === "BUDGET_CONFLICT"
      )
        await recover();
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  const busy = pending || context.budgetBusy;
  return (
    <SettingsDialog
      title={opened.budgetKrw === null ? "예산 설정" : "예산 수정"}
      onClose={close}
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <p className="text-dark-gray">여행 전체의 예산을 설정해 주세요.</p>
        <div>
          <label htmlFor={inputId} className="font-semibold">
            예산 (KRW)
          </label>
          <ExpenseAmountInput
            id={inputId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={draft}
            disabled={busy}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className={expenseInputClass}
            onChange={(value) => {
              setDraft(value);
              setError("");
            }}
          />
        </div>
        {error && (
          <p
            id={errorId}
            role="alert"
            className="text-sm text-status-negative"
          >
            {error}
          </p>
        )}
        {!context.canManage && (
          <p role="alert" className="text-sm text-status-negative">
            현재 참여 중인 방장과 멤버만 예산을 변경할 수 있어요.
          </p>
        )}
        {conflict && (
          <div
            role="alert"
            className="space-y-3 rounded-xl border border-gray-border p-4 text-sm"
          >
            <p>
              공유 예산이 변경되었어요. 작성한 금액은 유지돼요. 최신 예산을
              확인한 뒤 다시 저장해 주세요.
            </p>
            {conflict.latest ? (
              <>
                <p className="break-all">
                  최신 예산:{" "}
                  {conflict.latest.budgetKrw === null
                    ? "미설정"
                    : `${formatExpenseAmount(conflict.latest.budgetKrw)} KRW`}
                </p>
                <button
                  type="button"
                  className={expenseButtonClass}
                  disabled={busy || !context.canManage}
                  onClick={() => {
                    if (lock.current || !conflict.latest) return;
                    setVersion(conflict.latest.version);
                    setConflict(null);
                    setError("");
                  }}
                >
                  최신 예산 확인 후 수정 계속
                </button>
              </>
            ) : (
              <p>
                {conflict.failed
                  ? "최신 예산 조회에 실패했어요. 다시 조회한 뒤 확인해 주세요."
                  : "최신 예산 확인 중…"}
              </p>
            )}
            {conflict.failed && (
              <button
                type="button"
                className={expenseButtonClass}
                disabled={busy}
                onClick={() => void reload()}
              >
                최신 예산 다시 조회
              </button>
            )}
          </div>
        )}
        <SettingsActionButtonRow>
          <SettingsActionButton
            variant="secondary"
            disabled={busy}
            onClick={close}
          >
            취소
          </SettingsActionButton>
          <SettingsActionButton
            variant="primary"
            type="submit"
            disabled={busy || !context.canManage || Boolean(conflict)}
          >
            {busy ? "저장 중…" : "저장"}
          </SettingsActionButton>
        </SettingsActionButtonRow>
      </form>
    </SettingsDialog>
  );
}
