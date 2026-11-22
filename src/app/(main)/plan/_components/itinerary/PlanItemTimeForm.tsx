"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { useId, useRef } from "react";
import { toast } from "sonner";

import { TimeClockIcon } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

  const timeSchema = createScheduleTimeSchema({ serverStartHm, serverEndHm });

  const form = useForm({
    defaultValues: UNTOUCHED_DRAFT,
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
            ...(endHm !== serverEndHm || (value.start === "" && serverStartHm) ? { endTime: endHm || null } : {}),
          },
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "시간을 저장하지 못했어요.");
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
  const durationPreview = startHm && endHm ? computeDurationMinutesFromRange(startHm, endHm) : null;
  const dirty = serverStartHm !== startHm || serverEndHm !== endHm;
  const timeIssue = timeSchema.safeParse(draft).error?.issues[0];

  function submit() {
    if (isPending || savingRef.current || form.state.isSubmitting || !dirty || timeIssue) return;
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
      <DialogContent size="sm" initialFocus={() => formRef.current?.querySelector("input") ?? true}>
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
          {(
            [
              { name: "start", label: "시작", serverValue: serverStartHm, disabled: isPending },
              {
                name: "end",
                label: "종료",
                serverValue: serverEndHm,
                disabled: isPending || !normalizeStartTimeToHm(startHm),
              },
            ] as const
          ).map(({ name, label, serverValue, disabled }) => (
            <form.Field key={name} name={name}>
              {(field) => {
                const issue = timeIssue?.path[0] === name ? timeIssue : undefined;
                const errorId = `${formId}-${name}-error`;
                return (
                  <Field>
                    <div className="flex items-center gap-3">
                      <span className={`${fieldLabelClass} w-10 shrink-0 text-center`}>{label}</span>
                      <TimeInput
                        label={label}
                        value={field.state.value ?? serverValue}
                        onChange={field.handleChange}
                        disabled={disabled}
                        describedBy={issue ? `${formId}-help ${errorId}` : `${formId}-help`}
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
              <span className="text-dark-gray/70">미설정</span>
            ) : endHm.length === 0 ? (
              <span className="text-dark-gray/70">종료 없이도 저장할 수 있어요</span>
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
