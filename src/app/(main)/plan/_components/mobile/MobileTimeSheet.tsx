"use client";

import { useState } from "react";
import { toast } from "sonner";

import { MobileBottomSheet } from "@/components/mobile/MobileBottomSheet";
import { useUpdateScheduleItem } from "@/hooks/useRooms";
import {
  normalizeStartTimeToHm,
  validateScheduleTimeDraft,
} from "@/lib/plan/scheduleTime";
import { cn } from "@/lib/utils";

import { TimeWheelPicker, type TimeWheelValue } from "../itinerary/TimeWheelPicker";

type Field = "start" | "end";

type MobileTimeSheetProps = {
  roomId: string;
  scheduleId: number;
  itemId: number;
  placeName: string;
  startTime: string | null | undefined;
  endTime: string | null | undefined;
  onClose: () => void;
};

function toWheel(hm: string, fallback: TimeWheelValue): TimeWheelValue {
  if (!hm) return fallback;
  const [h, m] = hm.split(":").map(Number);
  return { hour: h ?? fallback.hour, minute: m ?? fallback.minute };
}

function toHm({ hour, minute }: TimeWheelValue): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** 방문 시간 시트 — 시작·종료 칸을 누르면 휠 피커로 고른다 */
export function MobileTimeSheet({
  roomId,
  scheduleId,
  itemId,
  placeName,
  startTime,
  endTime,
  onClose,
}: MobileTimeSheetProps) {
  const serverStart = normalizeStartTimeToHm(startTime ?? "");
  const serverEnd = normalizeStartTimeToHm(endTime ?? "");
  const [start, setStart] = useState(serverStart);
  const [end, setEnd] = useState(serverEnd);
  const [activeField, setActiveField] = useState<Field | null>(null);
  const { mutateAsync, isPending } = useUpdateScheduleItem();

  const dirty = start !== serverStart || end !== serverEnd;
  const validation = validateScheduleTimeDraft(start, end);

  function openField(field: Field) {
    if (field === "end" && !start) return;
    setActiveField((current) => (current === field ? null : field));
    // 비어 있는 칸을 처음 열면 휠 기본값으로 채운다
    if (field === "start" && !start) setStart("12:00");
    if (field === "end" && !end) {
      const base = toWheel(start, { hour: 12, minute: 0 });
      setEnd(toHm({ hour: (base.hour + 1) % 24, minute: base.minute }));
    }
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
    { key: "start", label: "시작", value: start },
    { key: "end", label: "종료", value: end },
  ];

  return (
    <MobileBottomSheet
      open
      onClose={onClose}
      title="방문 시간"
      subtitle={placeName}
      variant="form"
      closeDisabled={isPending}
    >
      <div className="grid grid-cols-2 gap-3">
        {fields.map(({ key, label, value }) => (
          <div key={key} className="flex min-w-0 flex-col gap-2">
            <span className="text-caption-l-regular text-text-subtle">{label}</span>
            <button
              type="button"
              onClick={() => openField(key)}
              disabled={isPending || (key === "end" && !start)}
              aria-expanded={activeField === key}
              className={cn(
                "rounded-xl bg-fill p-3 text-left text-body-l-regular font-medium tabular-nums disabled:opacity-40",
                value ? "text-text" : "text-text-subtle",
                activeField === key && "ring-2 ring-primary",
              )}
            >
              {value || "--:--"}
            </button>
          </div>
        ))}
      </div>

      {activeField ? (
        <TimeWheelPicker
          value={toWheel(activeField === "start" ? start : end, { hour: 12, minute: 0 })}
          onChange={(next) => (activeField === "start" ? setStart : setEnd)(toHm(next))}
          disabled={isPending}
        />
      ) : null}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={isPending || !dirty || !validation.valid}
        className="min-h-12 w-full rounded-xl bg-primary text-label-m-regular text-fill-elevate disabled:opacity-40"
      >
        {isPending ? "저장 중…" : "저장"}
      </button>
      <div className="flex items-center justify-between gap-3">
        <p className="text-caption-l-regular text-text-subtle">
          종료가 시작보다 이르면 다음 날로 표시
        </p>
        {start || end ? (
          <button
            type="button"
            onClick={() => {
              setStart("");
              setEnd("");
              setActiveField(null);
            }}
            disabled={isPending}
            className="shrink-0 text-caption-l-regular text-text-subtle underline underline-offset-2 disabled:opacity-40"
          >
            시간 지우기
          </button>
        ) : null}
      </div>
    </MobileBottomSheet>
  );
}
