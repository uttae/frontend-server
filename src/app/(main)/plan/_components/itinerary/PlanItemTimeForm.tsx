"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { useId, useRef } from "react";
import { toast } from "sonner";

import { TimeClockIcon } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUpdateScheduleItem } from "@/hooks/useRooms";
import { PLAN_PLACE_CARD_TW } from "@/lib/layout-tokens";
import {
  computeDurationMinutesFromRange,
  createScheduleTimeSchema,
  normalizeStartTimeToHm,
  resolveScheduleTimeDraft,
  type ScheduleTimeDraft,
} from "@/lib/plan/scheduleTime";

import { TimeInput } from "./TimeInput";

type PlanItemTimeEditorProps = {
  roomId: string;
  scheduleId: number;
  itemId: number;
  startTime: string;
  endTime: string | null | undefined;
  onClose: () => void;
};

// 칸 값이 undefined면 사용자가 아직 고치지 않은 칸이라 재조회된 서버 값을 따른다
const UNTOUCHED_DRAFT: ScheduleTimeDraft = { start: undefined, end: undefined };

const fieldLabelClass = PLAN_PLACE_CARD_TW.timeFieldLabel;

export function PlanItemTimeEditor({
  roomId,
  scheduleId,
  itemId,
  startTime,
  endTime,
  onClose,
}: PlanItemTimeEditorProps) {
  const serverStartHm = normalizeStartTimeToHm(startTime);
  const serverEndHm = normalizeStartTimeToHm(endTime ?? "");
  const { mutateAsync, isPending } = useUpdateScheduleItem();
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const savingRef = useRef(false);

  // 서버 값과 합친 시각을 검증한다. 렌더 중(오류 문장)과 제출이 같은 스키마를 쓴다
  const timeSchema = createScheduleTimeSchema({ serverStartHm, serverEndHm });

  const form = useForm({
    // 편집한 칸의 초안만 값으로 들고 나머지는 서버 값을 따른다. defaultValues에 서버 값을 넣으면
    // 한 칸만 고쳐도 폼 전체가 touched가 되어 다른 칸이 재조회 값을 따라가지 못한다(FormApi.update)
    defaultValues: UNTOUCHED_DRAFT,
    validators: {
      // 시작·종료 교차 검증이라 폼 단위다. 오류 문장은 입력 즉시 렌더 중에 보이므로, 여기서는 Enter로 들어온 제출만 막는다
      onSubmit: timeSchema,
    },
    onSubmit: async ({ value }) => {
      const { startHm, endHm } = timeSchema.parse(value);
      savingRef.current = true;
      try {
        await mutateAsync({
          roomId,
          scheduleId,
          itemId,
          body: {
            ...(startHm !== serverStartHm ? { startTime: startHm || null } : {}),
            ...(endHm !== serverEndHm || (value.start === "" && serverStartHm)
              ? { endTime: endHm || null }
              : {}),
          },
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "시간을 저장하지 못했어요.",
        );
        return;
      } finally {
        savingRef.current = false;
      }
      toast.success("시간을 저장했어요.");
      onClose();
    },
  });

  const draft = useStore(form.store, (state) => state.values);
  const { startHm, endHm } = resolveScheduleTimeDraft(draft, { serverStartHm, serverEndHm });
  const durationPreview =
    startHm && endHm ? computeDurationMinutesFromRange(startHm, endHm) : null;
  const dirty = serverStartHm !== startHm || serverEndHm !== endHm;
  // 칸 오류는 입력 즉시, 재조회로 서버 값이 바뀌어도 맞게 렌더 중에 계산한다. 칸 validators는 그 칸을 바꿀 때만 돌아 서버 값 변화를 놓친다
  const timeIssue = timeSchema.safeParse(draft).error?.issues[0];

  function submit() {
    // 라이브러리는 연타를 막지 않는다. isPending은 다음 렌더에 바뀌어 ref 락을 함께 본다
    if (isPending || savingRef.current || form.state.isSubmitting || !dirty) return;
    void form.handleSubmit();
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      closeDisabled={isPending}
    >
      {/* 처음 포커스는 시작 시 입력(지금 동작). 닫히면 Base UI가 연 버튼으로 포커스를 돌려준다 */}
      <DialogContent
        size="sm"
        initialFocus={() => formRef.current?.querySelector("input") ?? true}
      >
        <DialogHeader>
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <TimeClockIcon size={20} />
            </span>
            <DialogTitle className="min-w-0 flex-1">시간 설정</DialogTitle>
            <button
              type="button"
              aria-label="시간 초기화"
              onClick={() => {
                form.setFieldValue("start", "");
                form.setFieldValue("end", "");
              }}
              disabled={isPending || (!startHm && !endHm)}
              className="h-9 shrink-0 cursor-pointer rounded-lg px-2 text-label-xs-regular font-medium text-dark-gray transition hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              초기화
            </button>
          </div>
        </DialogHeader>

        <form
          ref={formRef}
          id={formId}
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <p id={`${formId}-help`} className="text-center text-body-xs-regular text-dark-gray">
            24시간 기준 · 시와 분을 직접 입력하세요
          </p>
          {([
            { name: "start", label: "시작", serverValue: serverStartHm, disabled: isPending },
            { name: "end", label: "종료", serverValue: serverEndHm, disabled: isPending || !normalizeStartTimeToHm(startHm) },
          ] as const).map(({ name, label, serverValue, disabled }) => (
            <form.Field key={name} name={name}>
              {(field) => {
                const issue = timeIssue?.path[0] === name ? timeIssue : undefined;
                const errorId = `${formId}-${name}-error`;
                return (
                  <Field>
                    <div className="flex items-center gap-3">
                      <span className={`${fieldLabelClass} w-10 shrink-0 text-center`}>
                        {label}
                      </span>
                      <TimeInput
                        label={label}
                        value={field.state.value ?? serverValue}
                        onChange={field.handleChange}
                        disabled={disabled}
                        describedBy={issue ? `${formId}-help ${errorId}` : `${formId}-help`}
                        // 적용 버튼이 비활성이어도 Enter로 제출을 시도한다. 틀린 값이면 폼 스키마가 막고 오류는 칸 아래 그대로다
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            submit();
                          }
                        }}
                      />
                    </div>
                    <FieldError id={errorId}>
                      {issue ? `${issue.message} 시는 00–23, 분은 00–59로 입력해 주세요.` : null}
                    </FieldError>
                  </Field>
                );
              }}
            </form.Field>
          ))}

          <div className="min-h-[16px] text-center text-body-xs-regular">
            {startHm.length === 0 ? (
              <span className="text-dark-gray/70">
                미설정
              </span>
            ) : endHm.length === 0 ? (
              <span className="text-dark-gray/70">
                종료 없이도 저장할 수 있어요
              </span>
            ) : durationPreview != null ? (
              <span className="tabular-nums text-dark-gray/85">
                {endHm < startHm ? "다음 날 종료 (+1일) · " : ""}
                {Math.floor(durationPreview / 60)}시간 {durationPreview % 60}분
              </span>
            ) : null}
          </div>
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="weak" />}>취소</DialogClose>
          <Button
            type="submit"
            form={formId}
            disabled={!dirty || Boolean(timeIssue)}
            loading={isPending}
            loadingLabel="저장 중"
          >
            적용
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
