"use client";

import { Clock, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useUpdateScheduleItem } from "@/hooks/useRooms";
import { PLAN_PLACE_CARD_TW } from "@/lib/layout-tokens";
import {
  addMinutesToHm,
  clampStayDurationMinutes,
  computeDurationMinutesFromRange,
  formatStayDurationMinutes,
  normalizeStartTimeToHm,
  SCHEDULE_STAY_DURATION_MAX_MINUTES,
} from "@/lib/plan/scheduleTime";
import { cn } from "@/lib/utils";

import { TimeWheelPicker, type TimeWheelValue } from "./TimeWheelPicker";

type PlanItemTimeEditorProps = {
  roomId: string;
  scheduleId: number;
  itemId: number;
  startTime: string;
  durationMinutes: number | null | undefined;
  onClose: () => void;
};

const fieldLabelClass = PLAN_PLACE_CARD_TW.timeFieldLabel;

const DEFAULT_START_WHEEL: TimeWheelValue = { hour: 9, minute: 0 };
const DEFAULT_END_WHEEL: TimeWheelValue = { hour: 10, minute: 0 };

function parseHmToWheel(hm: string, fallback: TimeWheelValue): TimeWheelValue {
  const m = /^(\d{2}):(\d{2})$/.exec(hm.trim());
  if (!m) return fallback;
  const hour = Math.min(23, Math.max(0, parseInt(m[1]!, 10)));
  const minute = Math.min(59, Math.max(0, parseInt(m[2]!, 10)));
  return { hour, minute };
}

function formatWheelToHm({ hour, minute }: TimeWheelValue): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function initialEndHm(
  startHm: string,
  durationMinutes: number | null | undefined,
): string {
  if (!startHm) return "";
  if (typeof durationMinutes !== "number" || !Number.isFinite(durationMinutes)) {
    return "";
  }
  return addMinutesToHm(startHm, clampStayDurationMinutes(durationMinutes));
}

export function PlanItemTimeEditor({
  roomId,
  scheduleId,
  itemId,
  startTime,
  durationMinutes,
  onClose,
}: PlanItemTimeEditorProps) {
  const serverStartHm = normalizeStartTimeToHm(startTime);

  const [startHm, setStartHm] = useState(() => serverStartHm);
  const [endHm, setEndHm] = useState(() =>
    initialEndHm(serverStartHm, durationMinutes),
  );

  const { mutateAsync, isPending } = useUpdateScheduleItem();

  useEffect(() => {
    setStartHm(serverStartHm);
    setEndHm(initialEndHm(serverStartHm, durationMinutes));
  }, [serverStartHm, durationMinutes]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isPending, onClose]);

  const hasDraftValue = startHm.length > 0 || endHm.length > 0;

  const durationPreview =
    startHm && endHm
      ? computeDurationMinutesFromRange(startHm, endHm)
      : null;

  const durationOverLimit =
    durationPreview != null &&
    durationPreview > SCHEDULE_STAY_DURATION_MAX_MINUTES;

  function handleReset() {
    setStartHm("");
    setEndHm("");
  }

  async function handleSave() {
    const trimmedStart = startHm.trim();
    const trimmedEnd = endHm.trim();

    if (trimmedEnd.length > 0 && trimmedStart.length === 0) {
      toast.error("시작 시각 없이 종료 시각만 설정할 수 없어요.");
      return;
    }

    let durationToSend: number | null = null;
    if (trimmedStart.length > 0 && trimmedEnd.length > 0) {
      const dur = computeDurationMinutesFromRange(trimmedStart, trimmedEnd);
      if (dur === null) {
        toast.error("시간을 올바르게 선택해 주세요.");
        return;
      }
      if (dur > SCHEDULE_STAY_DURATION_MAX_MINUTES) {
        toast.error(
          `체류 시간은 ${SCHEDULE_STAY_DURATION_MAX_MINUTES}분 이하여야 해요.`,
        );
        return;
      }
      durationToSend = dur;
    }

    try {
      await mutateAsync({
        roomId,
        scheduleId,
        itemId,
        body: {
          startTime: trimmedStart.length > 0 ? trimmedStart : null,
          durationMinutes: durationToSend,
        },
      });
      toast.success("시간을 저장했어요.");
      onClose();
    } catch {
      toast.error("시간을 저장하지 못했어요.");
    }
  }

  const baselineStart = serverStartHm;
  const baselineDur = formatStayDurationMinutes(durationMinutes);
  const currentDurStr =
    durationPreview != null ? String(durationPreview) : "0";
  const dirty =
    baselineStart !== startHm ||
    baselineDur !== currentDurStr ||
    // baseline may have had duration=null (미설정) — 종료를 지웠으면 dirty
    (typeof durationMinutes !== "number" && endHm.length > 0);

  const canSave = !isPending && dirty && !durationOverLimit;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isPending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-item-time-dialog-title"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-3xl bg-white shadow-xl"
      >
        <div className="flex items-center gap-2 px-6 pb-3 pt-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            <Clock className="h-5 w-5" aria-hidden />
          </span>
          <h2
            id="plan-item-time-dialog-title"
            className="flex-1 text-[19px] font-bold text-gray-900"
          >
            시간 설정
          </h2>
          {hasDraftValue ? (
            <button
              type="button"
              aria-label="시간 초기화"
              onClick={handleReset}
              disabled={isPending}
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-dark-gray transition hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>

        <div className="flex flex-col gap-4 px-4 pb-6 sm:px-6">
          <div className="flex items-start justify-center gap-3">
            <div className="flex flex-col items-center gap-1.5">
              <span className={fieldLabelClass}>시작</span>
              <TimeWheelPicker
                value={parseHmToWheel(startHm, DEFAULT_START_WHEEL)}
                disabled={isPending}
                onChange={(next) => {
                  const hm = formatWheelToHm(next);
                  setStartHm(hm);
                }}
              />
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <span className={fieldLabelClass} aria-hidden>
                {" "}
              </span>
              <div
                aria-hidden
                className="flex items-center justify-center text-xl font-semibold text-gray-400"
                style={{ height: 200 }}
              >
                ~
              </div>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <span className={fieldLabelClass}>종료</span>
              <TimeWheelPicker
                value={parseHmToWheel(
                  endHm,
                  startHm
                    ? parseHmToWheel(startHm, DEFAULT_END_WHEEL)
                    : DEFAULT_END_WHEEL,
                )}
                disabled={isPending || startHm.length === 0}
                onChange={(next) => {
                  const hm = formatWheelToHm(next);
                  setEndHm(hm);
                }}
              />
            </div>
          </div>

          <div className="min-h-[16px] text-center text-xs">
            {startHm.length === 0 ? (
              <span className="text-dark-gray/70">
                미설정 · 스크롤 또는 탭으로 시각 지정
              </span>
            ) : endHm.length === 0 ? (
              <span className="text-dark-gray/70">
                종료 없이도 저장할 수 있어요
              </span>
            ) : durationPreview != null ? (
              <span
                className={cn(
                  "tabular-nums",
                  durationOverLimit ? "text-primary" : "text-dark-gray/85",
                )}
              >
                체류 시간 {Math.floor(durationPreview / 60)}시간{" "}
                {durationPreview % 60}분
                {durationOverLimit
                  ? ` · 최대 ${SCHEDULE_STAY_DURATION_MAX_MINUTES}분 초과`
                  : ""}
              </span>
            ) : null}
          </div>

          <div className="mt-1 flex items-center justify-end gap-2">
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
              {isPending ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
