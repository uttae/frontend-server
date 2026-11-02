"use client";
import { revalidateLogic, useForm, useStore } from "@tanstack/react-form";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldCount, FieldError, FieldFooter, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useMobileView } from "@/contexts/MobileViewContext";
import {
  ExpenseApiError,
  expenseCategories,
  isExpenseCategory,
  type Expense,
  type ExpenseInput,
} from "@/lib/api/rooms/expenses";
import { expenseTitle, normalizeExpenseName, expenseNameError } from "@/lib/expenses/expense-name";
import {
  amountError,
  expenseCategoryError,
  expenseLinkError,
  expenseMemoError,
  expenseRolesError,
} from "@/lib/expenses/expense-policy";
import { preferredExpenseCurrency, rememberExpenseCurrency } from "@/lib/expenses/expense-currency-preference";
import { useSchedulePlanPlaces } from "@/hooks/useRooms";

import { ExpenseSelect } from "./ExpenseSelect";
import { ExpenseCurrencyPicker } from "./ExpenseCurrencyPicker";
import { ExpenseAmountInput } from "./ExpenseAmountInput";
import { useExpenseContext } from "./ExpenseProvider";
import { ExpenseList, ExpenseRolePicker } from "./ExpenseViews";

export type ExpenseEntry = {
  expense?: Expense;
  scheduleId?: number;
  scheduleItemId?: number;
};

// 카테고리는 새 비용에서 고르기 전까지 빈 값이다
type ExpenseDraft = Omit<ExpenseInput, "category"> & { category: ExpenseInput["category"] | "" };

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
  const unavailable = pending ? <Spinner aria-label={message} /> : <p>{message}</p>;
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
            <Button
              variant="outline"
              size="sm"
              disabled={pending || targetChanged}
              onClick={onContinue}
            >
              최신 비용 확인 후 수정 계속
            </Button>
          )}
        </>
      ) : (
        unavailable
      )}
      {conflict.failed && (
        <Button variant="outline" size="sm" disabled={pending} onClick={onRecover}>
          최신 비용 다시 조회
        </Button>
      )}
    </div>
  );
}

function amountPlaceholder(currency: { fractionDigits: number } | undefined) {
  if (!currency) return "금액";
  return currency.fractionDigits ? `0.${"0".repeat(currency.fractionDigits)}` : "0";
}

// 오류 문장이 스크롤 밖이면 보이는 곳까지 스크롤한다(움직임 줄이기 설정이면 바로)
function revealError(element: Element | null | undefined) {
  const reduceMotion = typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  element?.scrollIntoView({
    block: "nearest",
    behavior: reduceMotion ? "instant" : "smooth",
  });
}

export function ExpenseEditor({
  initial,
  onClose,
}: {
  initial: ExpenseEntry;
  onClose: () => void;
}) {
  const context = useExpenseContext();
  const { isMobileDevice } = useMobileView();
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
  // 연 순간의 값으로 폼을 채운다. 열린 동안 서버 값이 바뀌어도(충돌 확인 뒤 original 교체 포함) 입력 칸은 다시 채우지 않는다
  const [defaultValues] = useState<ExpenseDraft>(() =>
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
  // 칸 오류 없이 폼 아래에 보이는 문장(준비 안 됨·저장 실패). 칸 오류는 각 칸의 FieldError다
  const [error, setError] = useState("");
  const [errorOccurrence, setErrorOccurrence] = useState(0);
  const errorMessageRef = useRef<HTMLParagraphElement>(null);
  function reportError(message: string) {
    setError(message);
    if (message) setErrorOccurrence(count => count + 1);
  }
  useEffect(() => {
    if (!error) return;
    revealError(errorMessageRef.current);
  }, [error, errorOccurrence]);
  const [saving, setSaving] = useState(false);
  const submitLock = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const formId = useId();
  const errorId = useId();
  const nameId = useId();
  const amountId = useId();
  const dayId = useId();
  const placeId = useId();
  const categoryId = useId();
  const memoId = useId();
  const pending = saving || context.busy;

  const form = useForm({
    defaultValues,
    // 제출 전에는 검증하지 않고, 한 번 제출한 뒤에는 입력할 때마다 그 칸을 다시 검증한다
    validationLogic: revalidateLogic(),
    // 어느 칸이든 바꾸면 폼 아래 문장(저장 실패 등)을 지운다(지금 동작)
    listeners: { onChange: () => reportError("") },
    onSubmit: async ({ value }) => {
      const category = value.category;
      if (!isExpenseCategory(category)) return;
      setSaving(true);
      reportError("");
      // Send only request fields, never id/timestamps from the original response.
      const payload: ExpenseInput = {
        expenseGroup: value.expenseGroup,
        scheduleId: value.scheduleId,
        scheduleItemId: value.scheduleItemId,
        totalAmount: value.totalAmount,
        currency: value.currency,
        category,
        ...(original && value.name === original.name ? {} : { name: normalizeExpenseName(value.name) }),
        memo: value.memo,
        payerUserIds: value.payerUserIds,
        participantUserIds: value.participantUserIds,
      };
      try {
        await context.save(payload, original?.id, original?.version);
        if (!original) rememberExpenseCurrency(context.currentUserId, context.roomId, payload.currency);
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
        setSaving(false);
      }
    },
  });
  const body = useStore(form.store, (state) => state.values);

  const manuallySelectedCurrency = useRef<string | null>(null);
  const preferenceScope = `${context.currentUserId ?? ""}:${context.roomId}`;
  useEffect(() => {
    if (original || !context.currencies.isSuccess || manuallySelectedCurrency.current === preferenceScope)
      return;
    const selected = preferredExpenseCurrency(
      context.currentUserId,
      context.roomId,
      context.currencies.data ?? [],
    );
    // 기본 통화를 채우는 것이라 사용자 입력처럼 다루지 않는다(오류 문장 유지, 검증·변경 표시 없음)
    if (form.getFieldValue("currency") !== selected)
      form.setFieldValue("currency", selected, { dontUpdateMeta: true, dontRunListeners: true, dontValidate: true });
  }, [form, original, context.currentUserId, context.roomId, context.currencies.data, context.currencies.isSuccess, preferenceScope]);

  const places = useSchedulePlanPlaces(context.roomId, body.scheduleId);
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
  const currencyOf = (code: string) => context.currencies.data?.find((c) => c.currency === code);
  const currency = currencyOf(body.currency);
  // 일차 구분·연결 장소 검증에 쓰는 일차 목록. 장소는 지금 고른 일차의 것만 안다
  const days = (scheduleId: number | null) => context.schedules.map((s) => ({
    ...s,
    items:
      s.scheduleId === scheduleId
        ? (places.data ?? []).flatMap((p) =>
            p.itemId === undefined ? [] : [{ itemId: p.itemId }],
          )
        : [],
  }));

  async function submit() {
    submitLock.current = true;
    try {
      await form.handleSubmit();
    } finally {
      submitLock.current = false;
    }
    // 칸 오류가 스크롤 밖이면 첫 오류를 보여 준다(지금 폼 아래 오류 문장과 같은 처리)
    if (!form.state.isValid) revealError(formRef.current?.querySelector("[data-slot=field-error]"));
  }
  function handleFormSubmit(event: FormEvent) {
    event.preventDefault();
    // 라이브러리는 연타를 막지 않는다. submitLock은 검증이 비동기로 끝나기 전 두 번째 제출을 막는다
    if (submitLock.current || form.state.isSubmitting || pending) return;
    if (conflict || targetChanged) return;
    if (!ready) {
      reportError("멤버·통화·일차 정보를 확인한 뒤 다시 시도해 주세요.");
      return;
    }
    void submit();
  }

  const memberFallback = context.memberStatus === "error"
              ? <output className="block text-body-s-regular mobile:text-body-xs-regular text-dark-gray">멤버 정보 조회 실패. 기존 선택은 유지되며 저장은 잠시 중단돼요.</output>
              : <Spinner aria-label="멤버 정보 불러오는 중" className="flex min-h-28 w-full" />;
  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      closeDisabled={pending}
      // PC는 딤을 눌러도 닫지 않고(입력 보호), 시트는 딤을 눌러 닫는다(지금 동작)
      disablePointerDismissal={!isMobileDevice}
    >
      <ResponsiveDialogContent size="lg" drawerSize="belowNav">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{original ? "비용 수정" : "비용 추가"}</ResponsiveDialogTitle>
          {/* 보조 줄은 시트에서만 보인다(지금 화면과 같음) */}
          {isMobileDevice ? (
            <ResponsiveDialogDescription>
              {original ? expenseTitle(original) : "제목과 결제 정보를 입력해주세요."}
            </ResponsiveDialogDescription>
          ) : null}
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody>
          <form
            ref={formRef}
            id={formId}
            onSubmit={handleFormSubmit}
            noValidate
            className="flex flex-col gap-5"
            aria-describedby={error ? errorId : undefined}
          >
            <fieldset disabled={pending} className="flex min-w-0 flex-col gap-5 mobile:gap-4">
              <form.Field name="name" validators={{ onDynamic: ({ value }) => expenseNameError(value) ?? undefined }}>
                {(field) => {
                  const fieldError = field.state.meta.errors[0];
                  return (
                    <Field>
                      <FieldLabel htmlFor={nameId}>제목 (선택)</FieldLabel>
                      <Input id={nameId} name="expense-title" aria-label="제목 (선택)" maxLength={100}
                        placeholder="제목 없음"
                        value={field.state.value ?? ""}
                        onChange={(event) => field.handleChange(event.target.value)}
                        onBlur={field.handleBlur}
                        aria-invalid={fieldError ? true : undefined}
                        aria-describedby={fieldError ? `${nameId}-error` : undefined} />
                      <FieldError id={`${nameId}-error`}>{fieldError}</FieldError>
                    </Field>
                  );
                }}
              </form.Field>
              {/* 통화 이름이 숨는 조건(ExpenseCurrencyPicker의 mobile·max-sm)에서는 통화 칸을 코드 3글자 + ▼ 폭으로 줄여 금액 칸을 넓힌다.
                  112 = 트리거 테두리 2 + 좌우 여백 24 + 간격 8 + ▼ 자리 32 + 코드 46(16px 글자에서 가장 넓은 MWK 37 + 여유) */}
              <div className="grid min-w-0 grid-cols-[minmax(0,200px)_minmax(0,1fr)] items-start gap-4 rounded-2xl bg-fill p-4 mobile:grid-cols-[112px_minmax(0,1fr)] max-sm:grid-cols-[112px_minmax(0,1fr)] mobile:gap-3 mobile:p-3">
                <form.Field name="currency">
                  {(field) => (
                    <ExpenseCurrencyPicker
                      value={field.state.value}
                      currencies={context.currencies.data ?? []}
                      disabled={pending || !context.currencies.isSuccess}
                      onChange={(value) => {
                        manuallySelectedCurrency.current = preferenceScope;
                        field.handleChange(value);
                      }}
                    />
                  )}
                </form.Field>
                <form.Field
                  name="totalAmount"
                  validators={{
                    // 통화마다 소수 자리·최대 금액이 달라 통화를 바꾸면 금액도 다시 검증한다
                    onChangeListenTo: ["currency"],
                    onDynamic: ({ value, fieldApi }) =>
                      amountError(value, currencyOf(fieldApi.form.getFieldValue("currency"))) ?? undefined,
                  }}
                >
                  {(field) => {
                    const fieldError = field.state.meta.errors[0];
                    return (
                      <Field>
                        <FieldLabel htmlFor={amountId}>금액</FieldLabel>
                        <ExpenseAmountInput
                          id={amountId}
                          value={field.state.value}
                          fractionDigits={currency?.fractionDigits}
                          onChange={(value) => field.handleChange(value)}
                          placeholder={amountPlaceholder(currency)}
                          aria-invalid={fieldError ? true : undefined}
                          aria-describedby={fieldError ? `${amountId}-error` : undefined}
                        />
                        <FieldError id={`${amountId}-error`}>{fieldError}</FieldError>
                      </Field>
                    );
                  }}
                </form.Field>
              </div>
              {!context.currencies.isSuccess && (
                <output className={context.currencies.isError ? "text-body-s-regular mobile:text-body-xs-regular text-dark-gray" : "sr-only"}>
                  {context.currencies.isError
                    ? "통화 목록 조회에 실패했어요."
                    : "통화 목록을 불러오는 중…"}
                </output>
              )}
              <Field>
                <FieldLabel htmlFor={dayId}>일차 구분</FieldLabel>
                <ExpenseSelect
                  id={dayId}
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
                    // 일차를 바꾸면 연결 장소를 비운다. 마지막 setFieldValue가 연결 장소 칸을 다시 검증하고 폼 아래 문장을 지운다
                    form.setFieldValue("expenseGroup", value === "PREPARATION" ? "PREPARATION" : "TRIP_DAY");
                    form.setFieldValue("scheduleId", value === "PREPARATION" ? null : Number(value));
                    form.setFieldValue("scheduleItemId", null);
                  }}
                />
              </Field>
              <form.Field
                name="scheduleItemId"
                validators={{
                  // 일차는 칸이 따로 없어 일차 구분 onChange가 이 칸 값을 비우면서 다시 검증된다
                  onDynamic: ({ fieldApi }) => {
                    const values = fieldApi.form.state.values;
                    return expenseLinkError(values, days(values.scheduleId)) ?? undefined;
                  },
                }}
              >
                {(field) => {
                  const fieldError = field.state.meta.errors[0];
                  return (
                    <Field>
                      <FieldLabel htmlFor={placeId}>연결 장소 (선택)</FieldLabel>
                      <ExpenseSelect
                        id={placeId}
                        label="연결 장소 (선택)"
                        value={field.state.value === null ? "" : String(field.state.value)}
                        disabled={pending || body.expenseGroup === "PREPARATION" || !places.isSuccess}
                        options={[
                          { value: "", label: "장소 연결 없음" },
                          ...(body.expenseGroup === "TRIP_DAY" ? places.data ?? [] : [])
                            .filter((p) => p.itemId !== undefined)
                            .map((p) => ({ value: String(p.itemId), label: p.title })),
                        ]}
                        onChange={(value) => field.handleChange(value ? Number(value) : null)}
                        aria-invalid={Boolean(fieldError)}
                      />
                      <FieldError>{fieldError}</FieldError>
                      {body.expenseGroup === "TRIP_DAY" && !places.isSuccess && (
                        <p className={places.isError ? "text-body-s-regular mobile:text-body-xs-regular text-dark-gray" : "sr-only"}>
                          {places.isError
                            ? "장소 조회에 실패했어요. 새로고침 후 다시 시도해 주세요."
                            : "장소 확인 중…"}
                        </p>
                      )}
                    </Field>
                  );
                }}
              </form.Field>
              <form.Field name="category" validators={{ onDynamic: ({ value }) => expenseCategoryError(value) ?? undefined }}>
                {(field) => {
                  const fieldError = field.state.meta.errors[0];
                  return (
                    <Field>
                      <FieldLabel htmlFor={categoryId}>카테고리</FieldLabel>
                      <ExpenseSelect
                        id={categoryId}
                        name="category"
                        label="카테고리"
                        placeholder="카테고리 선택"
                        disabled={pending}
                        value={field.state.value}
                        options={[...expenseCategories]}
                        onChange={(value) => {
                          if (isExpenseCategory(value)) field.handleChange(value);
                        }}
                        aria-invalid={Boolean(fieldError)}
                      />
                      <FieldError>{fieldError}</FieldError>
                    </Field>
                  );
                }}
              </form.Field>
              {context.memberStatus === "success" ? (
                // 결제자·부담자는 함께 검증한다(각각 한 명 이상·중복 없음·고를 수 있는 멤버). 오류는 두 칸 아래 하나로 보인다
                <form.Field
                  name="payerUserIds"
                  validators={{
                    onChangeListenTo: ["participantUserIds"],
                    onDynamic: ({ fieldApi }) =>
                      expenseRolesError(fieldApi.form.state.values, context.members, original) ?? undefined,
                  }}
                >
                  {(payers) => (
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="grid min-w-0 grid-cols-2 gap-4 mobile:gap-3">
                        <ExpenseRolePicker
                          title="결제자"
                          members={context.members}
                          currentUserId={context.currentUserId}
                          selected={payers.state.value}
                          original={original?.payerUserIds ?? []}
                          disabled={pending}
                          onChange={(ids) => payers.handleChange(ids)}
                        />
                        <form.Field name="participantUserIds">
                          {(participants) => (
                            <ExpenseRolePicker
                              title="부담자"
                              members={context.members}
                              currentUserId={context.currentUserId}
                              selected={participants.state.value}
                              original={original?.participantUserIds ?? []}
                              disabled={pending}
                              onChange={(ids) => participants.handleChange(ids)}
                            />
                          )}
                        </form.Field>
                      </div>
                      <FieldError>{payers.state.meta.errors[0]}</FieldError>
                    </div>
                  )}
                </form.Field>
              ) : (
                memberFallback
              )}
              <form.Field name="memo" validators={{ onDynamic: ({ value }) => expenseMemoError(value) ?? undefined }}>
                {(field) => {
                  const fieldError = field.state.meta.errors[0];
                  return (
                    <Field>
                      <FieldLabel htmlFor={memoId}>메모 (선택)</FieldLabel>
                      <Textarea
                        id={memoId}
                        rows={3}
                        maxLength={1000}
                        value={field.state.value ?? ""}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        aria-invalid={fieldError ? true : undefined}
                        aria-describedby={fieldError ? `${memoId}-error` : undefined}
                      />
                      <FieldFooter>
                        <FieldError id={`${memoId}-error`}>{fieldError}</FieldError>
                        <FieldCount>{field.state.value?.length ?? 0}/1000</FieldCount>
                      </FieldFooter>
                    </Field>
                  );
                }}
              </form.Field>
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
          </form>
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <ResponsiveDialogClose render={<Button variant="weak" />}>취소</ResponsiveDialogClose>
          <Button
            type="submit"
            form={formId}
            disabled={!ready || Boolean(conflict) || targetChanged}
            loading={pending}
            loadingLabel="저장 중"
          >
            저장
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
