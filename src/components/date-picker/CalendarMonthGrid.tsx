import type { KeyboardEvent } from "react";

import { WEEKDAYS_KO } from "@/lib/plan/tripRange";
import { cn } from "@/lib/utils";

import { buildMonthWeeks, formatYmdKoreanFull, type DateRange, type YearMonth } from "./calendar";
import type { CalendarView } from "./useCalendarView";

type CellKind = "default" | "selected" | "disabled" | "rangeStart" | "rangeMiddle" | "rangeEnd";

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
          filled && "bg-primary text-body-m-emphasis text-text-inverse",
          disabled && "cursor-default text-text-disabled",
        )}
      >
        {Number(ymd.slice(8))}
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

export function CalendarMonthGrid({ calendar, month }: Readonly<{ calendar: CalendarView; month: YearMonth }>) {
  return (
    <div className="flex w-full flex-col gap-2">
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
      <div role="grid" aria-label={`${month.year}년 ${month.month + 1}월`} className="flex w-full flex-col gap-1">
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
  );
}
