import { useRef } from "react";

import { CloseIcon } from "@/assets/icons";
import { Button } from "@/components/ui/button";

import { formatSelectionSummary, type DateRange } from "./calendar";
import { CalendarMonth } from "./CalendarMonth";
import { useCalendarView } from "./useCalendarView";

export const DATE_RANGE_CALENDAR_MAX_HEIGHT = 546;

export function DateRangeCalendar({
  value,
  min,
  onSelect,
  onCancel,
  onConfirm,
}: Readonly<{
  value: DateRange;
  min?: string;
  onSelect: (ymd: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}>) {
  const gridsRef = useRef<HTMLDivElement>(null);
  const calendar = useCalendarView({ value, min, monthCount: 2, gridsRef, onSelect, onCancel, onConfirm });

  return (
    <div className="flex flex-col gap-5 rounded-[12px] bg-fill-elevate p-5 shadow-[0_2px_10px_rgba(31,34,41,0.10)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="min-w-0 truncate text-title-l text-text">일정 선택</h2>
        <button
          type="button"
          aria-label="닫기"
          onClick={onCancel}
          className="-m-2.5 grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-icon-subtle focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary"
        >
          <CloseIcon size={24} />
        </button>
      </div>
      <p aria-live="polite" className="sr-only">
        {formatSelectionSummary(value)}
      </p>
      <div ref={gridsRef} className="flex min-h-[360px] gap-7">
        <CalendarMonth calendar={calendar} panel={0} layout="modal" />
        <CalendarMonth calendar={calendar} panel={1} layout="modal" />
      </div>
      <div className="flex gap-3">
        <Button variant="weak" className="flex-1" onClick={calendar.cancel}>
          취소
        </Button>
        <Button className="flex-1" disabled={!calendar.canConfirm} onClick={calendar.confirm}>
          확인
        </Button>
      </div>
    </div>
  );
}
