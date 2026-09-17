"use client";

import { Clock, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useUpdateScheduleItem } from "@/hooks/useRooms";
import { PLAN_PLACE_CARD_TW } from "@/lib/layout-tokens";
import {
  computeDurationMinutesFromRange,
  normalizeStartTimeToHm,
  validateScheduleTimeDraft,
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

const fieldLabelClass = PLAN_PLACE_CARD_TW.timeFieldLabel;

function canonicalDraft(value: string): string {
  if (!/^\d{1,2}:\d{1,2}$/.test(value)) return value;
  return value.split(":").map((part) => part.padStart(2, "0")).join(":");
}

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
  // 편집한 필드의 초안은 보존하고 나머지는 재조회된 서버 값을 따릅니다.
  const [draftStart, setStartHm] = useState<string>();
  const [draftEnd, setEndHm] = useState<string>();
  const startHm = canonicalDraft(draftStart ?? serverStartHm);
  const endHm = canonicalDraft(draftEnd ?? serverEndHm);
  const { mutateAsync, isPending } = useUpdateScheduleItem();

  const dialogRef = useRef<HTMLDivElement>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    const opener = document.activeElement;
    dialogRef.current?.querySelector("input")?.focus();
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  const durationPreview =
    startHm && endHm ? computeDurationMinutesFromRange(startHm, endHm) : null;

  async function handleSave() {
    if (isPending || savingRef.current || !dirty) return;
    const validation = validateScheduleTimeDraft(startHm, endHm);
    if (!validation.valid) {
      toast.error(validation.message);
      return;
    }

    savingRef.current = true;
    try {
      await mutateAsync({
        roomId,
        scheduleId,
        itemId,
        body: {
          ...(startHm !== serverStartHm ? { startTime: startHm || null } : {}),
          ...(endHm !== serverEndHm || (draftStart === "" && serverStartHm)
            ? { endTime: endHm || null }
            : {}),
        },
      });
      toast.success("시간을 저장했어요.");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "시간을 저장하지 못했어요.",
      );
    } finally {
      savingRef.current = false;
    }
  }

  const dirty = serverStartHm !== startHm || serverEndHm !== endHm;
  const validation = validateScheduleTimeDraft(startHm, endHm);
  const canSave = !isPending && dirty && validation.valid;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isPending) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            if (!isPending && !savingRef.current) onClose();
          } else if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
            e.preventDefault();
            void handleSave();
          } else if (e.key === "Tab") {
            const controls = [...e.currentTarget.querySelectorAll<HTMLElement>(
              "button:not(:disabled), input:not(:disabled)",
            )];
            const first = controls[0];
            const last = controls.at(-1);
            if (!first) {
              e.preventDefault();
              e.currentTarget.focus();
            } else if (e.shiftKey && (document.activeElement === first || document.activeElement === e.currentTarget)) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && (document.activeElement === last || document.activeElement === e.currentTarget)) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
        aria-modal="true"
        aria-labelledby="plan-item-time-dialog-title"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center gap-2 px-5 pb-3 pt-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            <Clock className="h-5 w-5" aria-hidden />
          </span>
          <h2
            id="plan-item-time-dialog-title"
            className="flex-1 text-[17px] font-bold text-gray-900"
          >
            시간 설정
          </h2>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            disabled={isPending}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-dark-gray transition hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex flex-col gap-3 px-5 pb-4">
          <p id="plan-item-time-help" className="text-center text-xs text-dark-gray">
            24시간 기준 · 시와 분을 직접 입력하세요
          </p>
          {([
            { label: "시작", value: draftStart ?? serverStartHm, setValue: setStartHm, disabled: isPending },
            { label: "종료", value: draftEnd ?? serverEndHm, setValue: setEndHm, disabled: isPending || !normalizeStartTimeToHm(startHm) },
          ] as const).map(({ label, value, setValue, disabled }) => (
            <div key={label} className="flex items-center gap-3">
              <span className={`${fieldLabelClass} w-10 shrink-0 text-center`}>
                {label}
              </span>
              <TimeInput
                label={label}
                value={value}
                onChange={setValue}
                disabled={disabled}
                describedBy={`plan-item-time-help${validation.valid ? "" : " plan-item-time-error"}`}
              />
            </div>
          ))}
          {!validation.valid ? (
            <p id="plan-item-time-error" role="alert" className="text-xs text-red-600">
              {validation.message} 시는 00–23, 분은 00–59로 입력해 주세요.
            </p>
          ) : null}

          <div className="min-h-[16px] text-center text-xs">
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

          <div className="mt-1 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="h-10 shrink-0 cursor-pointer rounded-lg border border-gray-border bg-white px-4 text-sm font-medium text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!canSave}
              className="h-10 shrink-0 cursor-pointer rounded-lg bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPending ? "저장 중…" : "적용"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
