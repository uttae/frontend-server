"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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
    <Drawer open onOpenChange={(open) => { if (!open) onClose(); }} closeDisabled={isPending}>
      <DrawerContent closeLabel="방문 시간 닫기">
        <DrawerHeader>
          <DrawerTitle>{placeName}</DrawerTitle>
          {subtitle ? <DrawerDescription>{subtitle}</DrawerDescription> : null}
        </DrawerHeader>
        <DrawerBody className="gap-4">
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
            // 휠은 세로로 끌어 고른다. 시트가 같이 끌려 닫히지 않게 Base UI 스와이프에서 뺀다(옛 시트도 제목 줄에서만 끌렸다)
            <div data-base-ui-swipe-ignore="" inert={isPending} className={cn(isPending && "opacity-60")}>
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
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose render={<Button variant="weak" />}>취소</DrawerClose>
          <Button
            loading={isPending}
            loadingLabel="저장 중"
            disabled={!dirty || !validation.valid}
            onClick={() => void handleSave()}
          >
            확인
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
