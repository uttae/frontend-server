import { useState, type Ref, type RefObject } from "react";

import { ChevronDownIcon } from "@/assets/icons";

import { formatSelectionSummary, type DateRange, type YearMonth } from "./calendar";
import { CalendarMonthGrid } from "./CalendarMonthGrid";
import { MonthNavButton } from "./MonthNavButton";
import { MonthYearWheel } from "./MonthYearWheel";
import { useCalendarView } from "./useCalendarView";

export type MonthPicker = ReturnType<typeof useMonthPicker>;

export function useMonthPicker({
  value,
  min,
  gridsRef,
  onSelect,
}: {
  value: DateRange;
  min?: string;
  gridsRef: RefObject<HTMLElement | null>;
  onSelect: (ymd: string) => void;
}) {
  const calendar = useCalendarView({ value, min, monthCount: 1, gridsRef, onSelect });
  const [wheelOrigin, setWheelOrigin] = useState<YearMonth | null>(null);
  const [month] = calendar.months;
  return {
    calendar,
    month,
    isWheelOpen: wheelOrigin !== null,
    toggleWheel() {
      setWheelOrigin(wheelOrigin ? null : month);
    },
    closeWheel() {
      setWheelOrigin(null);
    },
    cancelWheel() {
      if (wheelOrigin) calendar.showView(wheelOrigin);
      setWheelOrigin(null);
    },
  };
}

export function DatePicker({ ref, picker }: Readonly<{ ref: Ref<HTMLDivElement>; picker: MonthPicker }>) {
  const { calendar, month } = picker;
  const thisYear = Number(calendar.todayYmd.slice(0, 4));

  return (
    <div ref={ref} className="flex w-full min-w-70 flex-col gap-5">
      <div className="flex min-h-11 w-full items-center justify-between">
        <div className="flex min-w-0 flex-col items-start justify-center gap-0.5">
          <button
            type="button"
            aria-expanded={picker.isWheelOpen}
            aria-label={`${month.year}년 ${month.month + 1}월, 연도와 월 선택`}
            onClick={picker.toggleWheel}
            className="flex items-center gap-1 rounded text-title-s text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {month.year}년 {month.month + 1}월
            <ChevronDownIcon size={16} className="text-icon" />
          </button>
          <p aria-live="polite" className="text-caption-m-regular text-text-subtle">
            {formatSelectionSummary(calendar.value)}
          </p>
        </div>
        <div className="flex shrink-0">
          <MonthNavButton direction="prev" disabled={!calendar.canGoPrev} onClick={() => calendar.shiftView(-1)} />
          <MonthNavButton direction="next" onClick={() => calendar.shiftView(1)} />
        </div>
      </div>
      {picker.isWheelOpen ? (
        <MonthYearWheel
          value={month}
          min={calendar.minMonth}
          fromYear={Math.min(calendar.minMonth?.year ?? thisYear - 1, month.year)}
          toYear={Math.max(thisYear + 5, month.year)}
          onChange={calendar.showView}
        />
      ) : (
        <CalendarMonthGrid calendar={calendar} month={month} />
      )}
    </div>
  );
}
