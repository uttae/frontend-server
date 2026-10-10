"use client";

import { useState } from "react";
import { toast } from "sonner";

import { LoadingIndicator } from "@/components/loading/LoadingIndicator";
import { MobileBottomSheet } from "@/components/mobile/MobileBottomSheet";
import { useUpdateScheduleItem } from "@/hooks/useRooms";
import {
  addMinutesToHm,
  computeDurationMinutesFromRange,
  normalizeStartTimeToHm,
  validateScheduleTimeDraft,
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

const DEFAULT_HM = "10:00";

/** "13:05" → "오후 1:05" — 휠과 같이 시를 0~11로 표기 */
function formatHm12h(hm: string): string {
  if (!hm) return "";
  const [h, m] = hm.split(":").map(Number);
  return `${h < 12 ? "오전" : "오후"} ${h % 12}:${String(m).padStart(2, "0")}`;
}

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
  const [start, setStart] = useState(serverStart || DEFAULT_HM);
  const [end, setEnd] = useState(serverEnd);
  const [activeField, setActiveField] = useState<Field | null>("start");
  const { mutateAsync, isPending } = useUpdateScheduleItem();

  const dirty = start !== serverStart || end !== serverEnd;
  const duration = computeDurationMinutesFromRange(start, end);
  const subtitle = [
    dateLabel,
    duration != null && end < start ? "다음 날 종료(+1일)" : null,
    duration != null ? `${Math.floor(duration / 60)}시간 ${duration % 60}분` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const validation = validateScheduleTimeDraft(start, end);

  function openField(field: Field) {
    if (field === "end" && !start) return;
    setActiveField((current) => (current === field ? null : field));
    // 비어 있는 칸을 처음 열면 휠 기본값으로 채운다
    if (field === "start" && !start) setStart(DEFAULT_HM);
    if (field === "end" && !end) setEnd(addMinutesToHm(start, 60));
  }

  async function handleSave() {
    if (isPending || !dirty) return;
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

  const fields: { key: Field; label: string; value: string }[] = [
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
    >
      <div className="flex w-full items-end gap-2">
        {fields.map(({ key, label, value }) => {
          const active = activeField === key;
          const display = formatHm12h(value);
          return (
            <button
              key={key}
              type="button"
              onClick={() => openField(key)}
              disabled={isPending || (key === "end" && !start)}
              aria-expanded={active}
              aria-label={`${label} ${display || "미설정"}`}
              className={cn(
                "flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg border bg-fill-subtle px-2 pb-1.5 pt-3 disabled:opacity-40",
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

      {activeField ? (
        <div inert={isPending} className={cn(isPending && "opacity-60")}>
          <TimeWheelPicker
            value={(activeField === "start" ? start : end) || DEFAULT_HM}
            onChange={activeField === "start" ? setStart : setEnd}
            active
            onInteract={() => {}}
          />
        </div>
      ) : null}

      {start || end ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setStart("");
              setEnd("");
              setActiveField(null);
            }}
            disabled={isPending}
            className="text-caption-l-regular text-text-subtle underline underline-offset-2 disabled:opacity-40"
          >
            시간 지우기
          </button>
        </div>
      ) : null}

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
          disabled={isPending || !dirty || !validation.valid}
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
    </MobileBottomSheet>
  );
}
