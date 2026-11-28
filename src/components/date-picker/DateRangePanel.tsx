import { useRef, type ReactNode } from "react";

import { RefreshIcon } from "@/assets/icons";

import { formatRangeLabel, type DateRange, type YearMonth } from "./calendar";
import { CalendarMonthGrid } from "./CalendarMonthGrid";
import { MonthNavButton } from "./MonthNavButton";
import { useCalendarView, type CalendarView } from "./useCalendarView";

const NAV_SPACER = <span aria-hidden className="size-11 shrink-0" />;

function PanelMonth({
  calendar,
  month,
  leading,
  trailing,
}: Readonly<{ calendar: CalendarView; month: YearMonth; leading: ReactNode; trailing: ReactNode }>) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-5">
      <div className="flex min-h-11 items-center justify-between">
        {leading}
        <p className="text-title-s text-text">
          {month.year}년 {month.month + 1}월
        </p>
        {trailing}
      </div>
      <CalendarMonthGrid calendar={calendar} month={month} />
    </div>
  );
}

export function DateRangePanel({
  value,
  min,
  onSelect,
  onReset,
}: Readonly<{ value: DateRange; min?: string; onSelect: (ymd: string) => void; onReset: () => void }>) {
  const gridsRef = useRef<HTMLDivElement>(null);
  const calendar = useCalendarView({ value, min, monthCount: 2, gridsRef, onSelect });
  const [leftMonth, rightMonth] = calendar.months;

  return (
    <div className="flex flex-col gap-5">
      <div ref={gridsRef} className="flex gap-10">
        <PanelMonth
          calendar={calendar}
          month={leftMonth}
          leading={
            <MonthNavButton direction="prev" disabled={!calendar.canGoPrev} onClick={() => calendar.shiftView(-1)} />
          }
          trailing={NAV_SPACER}
        />
        <PanelMonth
          calendar={calendar}
          month={rightMonth}
          leading={NAV_SPACER}
          trailing={<MonthNavButton direction="next" onClick={() => calendar.shiftView(1)} />}
        />
      </div>
      <hr className="border-border-subtle" />
      <div className="flex min-h-6 items-center justify-between gap-5">
        <button
          type="button"
          onClick={onReset}
          className="flex shrink-0 cursor-pointer items-center gap-1 rounded text-body-m-emphasis text-text-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <RefreshIcon size={20} />
          초기화
        </button>
        <p aria-live="polite" className="min-w-0 truncate text-right text-body-m-emphasis text-text-subtle">
          {formatRangeLabel(value)}
        </p>
      </div>
    </div>
  );
}
