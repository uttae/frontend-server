import type { KeyboardEvent, ReactNode } from "react";

import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "@/assets/icons";
import { WEEKDAYS_KO } from "@/lib/plan/tripRange";
import { cn } from "@/lib/utils";

import { addMonths, buildMonthWeeks, formatYmdKoreanFull, type DateRange } from "./calendar";
import { MonthYearWheel } from "./MonthYearWheel";
import type { CalendarView } from "./useCalendarView";

type CellKind = "default" | "selected" | "disabled" | "rangeStart" | "rangeMiddle" | "rangeEnd";

const LAYOUTS = {
  card: { panel: "w-full gap-2", header: "pl-3", grid: "max-w-[313px]" },
  modal: { panel: "min-w-0 flex-1 gap-5", header: "", grid: "" },
} as const;

function cellKind(ymd: string, { start, end }: DateRange, min?: string): CellKind {
  if (min && ymd < min) return "disabled";
  if (start && end && end > start) {
    if (ymd === start) return "rangeStart";
    if (ymd === end) return "rangeEnd";
    if (ymd > start && ymd < end) return "rangeMiddle";
  }
  return ymd === start ? "selected" : "default";
}

function DateCell({
  ymd,
  kind,
  isToday,
  tabbable,
  onSelect,
  onKeyDown,
}: Readonly<{
  ymd: string;
  kind: CellKind;
  isToday: boolean;
  tabbable: boolean;
  onSelect: (ymd: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, ymd: string) => void;
}>) {
  const disabled = kind === "disabled";
  const filled = kind === "selected" || kind === "rangeStart" || kind === "rangeEnd";
  return (
    <div
      role="gridcell"
      aria-selected={kind !== "default" && kind !== "disabled"}
      className="relative flex h-11 min-w-0 flex-1 items-center justify-center"
    >
      {kind === "rangeStart" || kind === "rangeMiddle" || kind === "rangeEnd" ? (
        <span
          aria-hidden
          className={cn(
            "absolute top-1/2 h-10 -translate-y-1/2 bg-fill-strong",
            kind === "rangeStart" && "left-1/2 right-0",
            kind === "rangeMiddle" && "inset-x-0",
            kind === "rangeEnd" && "left-0 right-1/2",
          )}
        />
      ) : null}
      <button
        type="button"
        data-ymd={ymd}
        tabIndex={tabbable ? 0 : -1}
        aria-label={`${formatYmdKoreanFull(ymd)}${isToday ? ", 오늘" : ""}`}
        aria-current={isToday ? "date" : undefined}
        aria-disabled={disabled || undefined}
        onClick={() => {
          if (!disabled) onSelect(ymd);
        }}
        onKeyDown={(event) => onKeyDown(event, ymd)}
        className={cn(
          "relative flex size-10 items-center justify-center rounded-full text-body-m-regular transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          kind === "default" && "text-text hover:bg-fill",
          kind === "rangeMiddle" && "text-text",
          filled && "bg-primary text-text-inverse",
          disabled && "cursor-default text-text-disabled",
        )}
      >
        {Number(ymd.slice(8))}
        {disabled ? (
          <span aria-hidden className="absolute left-3 top-5 h-px w-4 bg-text-disabled" />
        ) : null}
        {isToday ? (
          <span
            aria-hidden
            className={cn(
              "absolute left-[18.5px] top-[34px] size-[3px] rounded-full",
              filled ? "bg-text-inverse" : "bg-primary-strong",
            )}
          />
        ) : null}
      </button>
    </div>
  );
}

export function CalendarMonth({
  calendar,
  panel,
  layout,
  subtitle,
}: Readonly<{
  calendar: CalendarView;
  panel: number;
  layout: keyof typeof LAYOUTS;
  subtitle?: ReactNode;
}>) {
  const month = calendar.months[panel];
  const classes = LAYOUTS[layout];
  const isWheelOpen = calendar.wheelPanel === panel;
  const wheelMin = calendar.minMonth && addMonths(calendar.minMonth, panel);
  const thisYear = Number(calendar.todayYmd.slice(0, 4));

  return (
    <div className={cn("flex flex-col", classes.panel)}>
      <div className={cn("flex h-11 w-full items-center justify-between", classes.header)}>
        <div className="flex min-w-0 flex-col items-start justify-center gap-1">
          <button
            type="button"
            aria-expanded={isWheelOpen}
            aria-label={`${month.year}년 ${month.month + 1}월, 연도와 월 선택`}
            onClick={() => calendar.toggleWheel(panel)}
            className="flex items-center gap-1 rounded text-title-s text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {month.year}년 {month.month + 1}월
            <ChevronDownIcon size={16} className="text-icon" />
          </button>
          {subtitle}
        </div>
        <div className="flex shrink-0">
          <button
            type="button"
            aria-label="이전 달"
            disabled={!calendar.canGoPrev}
            onClick={() => calendar.shiftView(-1)}
            className="flex size-11 items-center justify-center rounded-full text-icon focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary disabled:text-icon-disabled"
          >
            <ChevronLeftIcon size={20} />
          </button>
          <button
            type="button"
            aria-label="다음 달"
            onClick={() => calendar.shiftView(1)}
            className="flex size-11 items-center justify-center rounded-full text-icon focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary"
          >
            <ChevronRightIcon size={20} />
          </button>
        </div>
      </div>

      {isWheelOpen ? (
        <MonthYearWheel
          value={month}
          min={wheelMin}
          fromYear={Math.min(wheelMin?.year ?? thisYear - 1, month.year)}
          toYear={Math.max(thisYear + 5, month.year)}
          onChange={calendar.pickWheelMonth}
        />
      ) : (
        <div className="flex w-full flex-col items-center gap-2">
          <div role="presentation" className="flex h-8 w-full">
            {WEEKDAYS_KO.map((weekday) => (
              <span
                key={weekday}
                aria-hidden
                className="flex min-w-0 flex-1 items-center justify-center text-label-m-regular text-text-subtle"
              >
                {weekday}
              </span>
            ))}
          </div>
          <div
            role="grid"
            aria-label={`${month.year}년 ${month.month + 1}월`}
            className={cn("flex w-full flex-col gap-1", classes.grid)}
          >
            {buildMonthWeeks(month).map((week) => (
              <div key={week.find(Boolean)} role="row" className="flex w-full">
                {week.map((ymd, index) =>
                  ymd ? (
                    <DateCell
                      key={ymd}
                      ymd={ymd}
                      kind={cellKind(ymd, calendar.value, calendar.min)}
                      isToday={ymd === calendar.todayYmd}
                      tabbable={ymd === calendar.tabbableYmd}
                      onSelect={calendar.selectDay}
                      onKeyDown={calendar.handleDayKeyDown}
                    />
                  ) : (
                    <div key={`empty-${index}`} role="gridcell" className="h-11 min-w-0 flex-1" />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
