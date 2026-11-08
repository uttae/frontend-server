"use client";
import { useForm } from "@tanstack/react-form";
import { useId, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import {
  ExpenseApiError,
  type ExpenseBudget,
} from "@/lib/api/rooms/expenses";
import { ExpenseAmountInput } from "./ExpenseAmountInput";
import { useExpenseContext } from "./ExpenseProvider";
import { formatExpenseAmount } from "./ExpenseViews";

function budgetError(value: string) {
  return /^\d{1,15}$/.test(value)
    ? undefined
    : "예산은 1~15자리 숫자로 입력해 주세요. 음수·소수점·공백은 사용할 수 없어요.";
}

export function ExpenseBudgetModal({
  initial,
  onClose,
}: Readonly<{
  initial: ExpenseBudget;
  onClose: () => void;
}>) {
  const context = useExpenseContext();
  // 연 순간의 예산으로 제목·칸을 정한다. 열린 동안 서버 값이 바뀌어도 칸을 다시 채우지 않는다
  const [opened] = useState(initial);
  const [version, setVersion] = useState(initial.version);
  // 입력 검증 오류는 칸의 Error 상태(form.Field)로, 저장 실패(네트워크·충돌·서버 메시지)는 칸 밖 문장으로 그린다
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [conflict, setConflict] = useState<{
    latest?: ExpenseBudget;
    failed?: boolean;
  } | null>(null);
  // 검증이 비동기로 끝나기 전 두 번째 제출과, 저장·재조회가 겹치는 것을 막는다
  const lock = useRef(false);
  const formId = useId();
  const inputId = useId();
  const errorId = useId();
  const title = opened.budgetKrw === null ? "예산 설정" : "예산 수정";

  const form = useForm({
    defaultValues: { budget: opened.budgetKrw ?? "" },
    onSubmit: async ({ value }) => {
      setPending(true);
      setSaveError(null);
      try {
        await context.saveBudget({
          budgetKrw: value.budget,
          expectedVersion: version,
        });
        onClose();
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "예산 저장에 실패했어요.");
        if (
          e instanceof ExpenseApiError &&
          e.status === 409 &&
          e.code === "BUDGET_CONFLICT"
        )
          await recover();
      } finally {
        setPending(false);
      }
    },
  });

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
  async function submit() {
    lock.current = true;
    try {
      await form.handleSubmit();
    } finally {
      lock.current = false;
    }
  }
  function handleFormSubmit(event: FormEvent) {
    event.preventDefault();
    // 라이브러리는 연타를 막지 않는다
    if (lock.current || form.state.isSubmitting || context.budgetBusy || !context.canManage || conflict)
      return;
    void submit();
  }
  const busy = pending || context.budgetBusy;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      // 저장·최신 예산 재조회 중에는 Esc·딤·X로 닫지 않는다(지금 동작)
      closeDisabled={pending}
    >
      <DialogContent size="sm" closeLabel={`${title} 닫기`}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">여행 전체의 예산을 설정해 주세요.</DialogDescription>
        </DialogHeader>
        <form
          id={formId}
          noValidate
          className="flex flex-col gap-6"
          onSubmit={handleFormSubmit}
        >
          <form.Field name="budget" validators={{ onSubmit: ({ value }) => budgetError(value) }}>
            {(field) => {
              const fieldError = field.state.meta.errors[0];
              return (
                <Field>
                  <FieldLabel htmlFor={inputId}>예산 (KRW)</FieldLabel>
                  <ExpenseAmountInput
                    id={inputId}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={field.state.value}
                    disabled={busy}
                    aria-invalid={Boolean(fieldError)}
                    aria-describedby={fieldError || saveError ? errorId : undefined}
                    onChange={(value) => {
                      // 칸 오류는 값이 바뀌면 TanStack Form이 지운다. 저장 실패 문장도 함께 지운다(지금 동작)
                      field.handleChange(value);
                      setSaveError(null);
                    }}
                  />
                  {/* 두 오류는 함께 뜨지 않아 id 하나를 나눠 쓴다 */}
                  <FieldError id={errorId}>{fieldError}</FieldError>
                </Field>
              );
            }}
          </form.Field>
          {saveError && (
            <p
              id={errorId}
              role="alert"
              className="text-body-s-regular mobile:text-body-xs-regular text-status-negative"
            >
              {saveError}
            </p>
          )}
          {!context.canManage && (
            <p role="alert" className="text-body-s-regular mobile:text-body-xs-regular text-status-negative">
              현재 참여 중인 방장과 멤버만 예산을 변경할 수 있어요.
            </p>
          )}
          {conflict && (
            <div
              role="alert"
              className="space-y-3 rounded-xl border border-gray-border p-4 text-body-s-regular mobile:text-body-xs-regular"
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
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || !context.canManage}
                    onClick={() => {
                      if (lock.current || !conflict.latest) return;
                      setVersion(conflict.latest.version);
                      setConflict(null);
                      setSaveError(null);
                    }}
                  >
                    최신 예산 확인 후 수정 계속
                  </Button>
                </>
              ) : (
                <p>
                  {conflict.failed
                    ? "최신 예산 조회에 실패했어요. 다시 조회한 뒤 확인해 주세요."
                    : <Spinner aria-label="최신 예산 확인 중" />}
                </p>
              )}
              {conflict.failed && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void reload()}
                >
                  최신 예산 다시 조회
                </Button>
              )}
            </div>
          )}
        </form>
        <DialogFooter>
          <DialogClose disabled={busy} render={<Button variant="weak" />}>
            취소
          </DialogClose>
          <Button
            type="submit"
            form={formId}
            loading={busy}
            loadingLabel="저장 중"
            disabled={!context.canManage || Boolean(conflict)}
          >
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
