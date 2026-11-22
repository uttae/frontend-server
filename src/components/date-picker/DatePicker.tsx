"use client";

import { useRef } from "react";

import { formatSelectionSummary, type DateRange } from "./calendar";
import { CalendarMonth } from "./CalendarMonth";
import { useCalendarView } from "./useCalendarView";

type DatePickerProps = Readonly<{
  value: DateRange;

  min?: string;
  onSelect: (ymd: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}>;

export function DatePicker({ value, min, onSelect, onCancel, onConfirm }: DatePickerProps) {
  const gridsRef = useRef<HTMLDivElement>(null);
  const calendar = useCalendarView({ value, min, monthCount: 1, gridsRef, onSelect, onCancel, onConfirm });

  return (
    <div
      ref={gridsRef}
      className="flex w-[353px] min-w-0 max-w-full flex-col items-center gap-2 rounded-[12px] bg-fill-subtle p-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]"
    >
      <CalendarMonth
        calendar={calendar}
        panel={0}
        layout="card"
        subtitle={
          <p aria-live="polite" className="text-caption-m-regular text-text-subtle">
            {formatSelectionSummary(value)}
          </p>
        }
      />
      <div className="flex h-11 w-full items-center gap-1 px-1">
        <button
          type="button"
          onClick={calendar.cancel}
          className="flex-1 rounded-md bg-fill-subtle px-2.5 py-2 text-label-m-emphasis text-text transition-colors hover:bg-fill hover:text-text-subtle active:bg-fill-strong active:text-text"
        >
          취소
        </button>
        <button
          type="button"
          onClick={calendar.confirm}
          disabled={!calendar.canConfirm}
          className="flex-1 rounded-md bg-[var(--gray-800)] px-2.5 py-2 text-label-m-emphasis text-text-inverse transition-colors enabled:hover:bg-[var(--gray-700)] enabled:active:bg-[var(--gray-900)] disabled:bg-fill disabled:text-text-disabled"
        >
          확인
        </button>
      </div>
    </div>
  );
}
