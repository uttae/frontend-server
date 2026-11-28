import { useRef, useState } from "react";

import { ChevronDownIcon } from "@/assets/icons";

import { formatSelectionSummary, type DateRange } from "./calendar";
import { CalendarMonthGrid } from "./CalendarMonthGrid";
import { MonthNavButton } from "./MonthNavButton";
import { MonthYearWheel } from "./MonthYearWheel";
import { useCalendarView } from "./useCalendarView";

export function DatePicker({
  value,
  min,
  onSelect,
}: Readonly<{ value: DateRange; min?: string; onSelect: (ymd: string) => void }>) {
  const gridsRef = useRef<HTMLDivElement>(null);
  const calendar = useCalendarView({ value, min, monthCount: 1, gridsRef, onSelect });
  const [isWheelOpen, setIsWheelOpen] = useState(false);
  const [month] = calendar.months;
  const thisYear = Number(calendar.todayYmd.slice(0, 4));

  return (
    <div ref={gridsRef} className="flex w-full min-w-70 flex-col gap-5">
      <div className="flex min-h-11 w-full items-center justify-between">
        <div className="flex min-w-0 flex-col items-start justify-center gap-0.5">
          <button
            type="button"
            aria-expanded={isWheelOpen}
            aria-label={`${month.year}년 ${month.month + 1}월, 연도와 월 선택`}
            onClick={() => setIsWheelOpen((open) => !open)}
            className="flex items-center gap-1 rounded text-title-s text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {month.year}년 {month.month + 1}월
            <ChevronDownIcon size={16} className="text-icon" />
          </button>
          <p aria-live="polite" className="text-caption-m-regular text-text-subtle">
            {formatSelectionSummary(value)}
          </p>
        </div>
        <div className="flex shrink-0">
          <MonthNavButton direction="prev" disabled={!calendar.canGoPrev} onClick={() => calendar.shiftView(-1)} />
          <MonthNavButton direction="next" onClick={() => calendar.shiftView(1)} />
        </div>
      </div>
      {isWheelOpen ? (
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
