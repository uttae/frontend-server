"use client";

import { useState } from "react";
import Image from "next/image";
import { formatTimePickerValue, timePartsFromHm, timePartsToHm, type TimeParts } from "@/lib/plan/timePickerDraft";
import { toast } from "sonner";

import { LoadingIndicator } from "@/components/loading/LoadingIndicator";
import { MobileBottomSheet } from "@/components/mobile/MobileBottomSheet";
import { useUpdateScheduleItem } from "@/hooks/useRooms";
import {
  computeDurationMinutesFromRange,
  normalizeStartTimeToHm,
  validateScheduleTimeDraft,
  type ScheduleTimeDraftValidation,
} from "@/lib/plan/scheduleTime";
import { cn } from "@/lib/utils";

import { TimeWheelPicker } from "../itinerary/TimeWheelPicker";

type Field = "start" | "end";

type MobileTimeSheetProps = Readonly<{
  roomId: string;
  scheduleId: number;
  itemId: number;
  placeName: string;
  /** `9월 21일` */
  dateLabel?: string;
  startTime: string | null | undefined;
  endTime: string | null | undefined;
  onClose: () => void;
}>;

/** 방문 시간 시트 — 시작·종료 칸을 누르면 휠 피커로 고른다 */
export function MobileTimeSheet({
  roomId,
  scheduleId,
  itemId,
  placeName,
  dateLabel,
  startTime,
  endTime,
  onClose,
}: MobileTimeSheetProps) {
  const serverStart = normalizeStartTimeToHm(startTime ?? "");
  const serverEnd = normalizeStartTimeToHm(endTime ?? "");
  const [draftStart, setStart] = useState<TimeParts>();
  const [draftEnd, setEnd] = useState<TimeParts>();
  const startParts = draftStart ?? timePartsFromHm(serverStart);
  const endParts = draftEnd ?? timePartsFromHm(serverEnd);
  const start = timePartsToHm(startParts);
  const end = timePartsToHm(endParts);
  const [activeField, setActiveField] = useState<Field | null>(serverEnd ? "end" : serverStart ? "start" : null);
  const [isWheelSettling, setWheelSettling] = useState(false);
  const { mutateAsync, isPending } = useUpdateScheduleItem();

  const dirty = start !== serverStart || end !== serverEnd;
  const duration = computeDurationMinutesFromRange(start ?? "", end ?? "");
  const subtitle = [
    dateLabel,
    duration != null && end !== null && start !== null && end < start ? "다음 날 종료(+1일)" : null,
    duration != null ? `${Math.floor(duration / 60)}시간 ${duration % 60}분` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const validation: ScheduleTimeDraftValidation = start === null || end === null
    ? { valid: false, message: "오전/오후, 시, 분을 모두 선택해 주세요." }
    : validateScheduleTimeDraft(start, end);

  function openField(field: Field) {
    if (field === "end" && !start) return;
    setActiveField((current) => (current === field ? null : field));
  }

  async function handleSave() {
    if (isPending || isWheelSettling || !dirty) return;
    if (!validation.valid) {
      toast.error(validation.message);
      return;
    }
    try {
      await mutateAsync({
        roomId,
        scheduleId,
        itemId,
        body: {
          ...(start !== serverStart ? { startTime: start || null } : {}),
          ...(end !== serverEnd || (!start && serverStart) ? { endTime: end || null } : {}),
        },
      });
      toast.success("시간을 저장했어요.");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "시간을 저장하지 못했어요.");
    }
  }

  const fields: { key: Field; label: string; value: string | null }[] = [
    { key: "start", label: "시작 시간", value: start },
    { key: "end", label: "종료 시간", value: end },
  ];

  return (
    <MobileBottomSheet
      open
      onClose={onClose}
      title={placeName}
      subtitle={subtitle || undefined}
      variant="form"
      closeDisabled={isPending}
      footer={
      <div className="flex h-11 w-full items-center gap-4 px-1">
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="flex-1 rounded-lg bg-fill-subtle px-2.5 py-2 text-label-m-emphasis text-text transition-colors enabled:hover:bg-fill enabled:hover:text-text-subtle enabled:active:bg-fill-strong enabled:active:text-text disabled:bg-fill disabled:text-text-disabled"
        >
          취소
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isPending || isWheelSettling || !dirty || !validation.valid}
          aria-busy={isPending}
          className={cn(
            "flex flex-1 items-center justify-center rounded-lg px-2.5 py-2 text-label-m-emphasis text-text-inverse transition-colors",
            isPending
              ? "bg-[var(--gray-900)]"
              : "bg-[var(--gray-800)] enabled:hover:bg-[var(--gray-700)] enabled:active:bg-[var(--gray-900)] disabled:bg-fill disabled:text-text-disabled",
          )}
        >
          {isPending ? <LoadingIndicator label="저장 중" className="text-text-inverse" /> : "확인"}
        </button>
      </div>
      }
    >
      <div className="flex w-full flex-col gap-3">
      <div className="flex h-[70px] w-full items-end gap-2">
        {fields.map(({ key, label, value }) => {
          const active = activeField === key;
          const display = formatTimePickerValue(value);
          return (
            <button
              key={key}
              type="button"
              onClick={() => openField(key)}
              disabled={isPending || isWheelSettling || (key === "end" && !start)}
              aria-expanded={active}
              aria-label={`${label} ${display || "미설정"}`}
              className={cn(
                "flex min-w-0 flex-1 flex-col gap-0.5 h-[70px] rounded-md border bg-fill-subtle px-2 pb-1.5 pt-3",
                active ? "border-primary" : "border-border",
              )}
            >
              <span
                className={cn(
                  "w-full px-1 text-center text-label-xs-regular",
                  active ? "text-primary-strong" : "text-text-subtle",
                )}
              >
                {label}
              </span>
              <span className="flex h-8 w-full items-center justify-center truncate px-1 text-body-m-regular tabular-nums text-text">
                {display || "-- : --"}
              </span>
            </button>
          );
        })}
      </div>

      <div inert={isPending}>
        <TimeWheelPicker
          key={activeField ?? "idle"}
          value={activeField === "end" ? endParts : startParts}
          onChange={activeField === "end" ? setEnd : setStart}
          active={activeField !== null}
          onSettlingChange={setWheelSettling}
        />
      </div>
      <div className="flex h-8 items-center justify-end px-1">
        <button
          type="button"
          disabled={isPending || (activeField === null && start === "" && end === "")}
          onClick={() => {
            setStart(timePartsFromHm(""));
            setEnd(timePartsFromHm(""));
            setActiveField(null);
            setWheelSettling(false);
          }}
          className="relative flex h-8 items-center gap-1 text-label-xs-regular text-text-subtle disabled:text-text-disabled before:absolute before:-inset-y-1.5 before:inset-x-0 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Image src={activeField === null && start === "" && end === "" ? "/icons/time-picker/reset-disabled.svg" : "/icons/time-picker/reset-active.svg"} width={16} height={16} alt="" />
          초기화
        </button>
      </div>
      </div>

    </MobileBottomSheet>
  );
}
