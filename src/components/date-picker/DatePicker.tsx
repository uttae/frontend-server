"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "@/assets/icons";
import { formatDateYmd, WEEKDAYS_KO } from "@/lib/plan/tripRange";
import { cn } from "@/lib/utils";

import {
  addDays,
  addMonths,
  buildMonthWeeks,
  formatSelectionSummary,
  formatYmdKoreanFull,
  monthIndex,
  toYearMonth,
  type DateRange,
  type YearMonth,
} from "./calendar";
import { MonthYearWheel } from "./MonthYearWheel";

/** Figma Date Picker 원본 폭 — 카드 클래스 `w-[353px]`와 같은 값 */
export const DATE_PICKER_WIDTH = 353;

type CellKind = "default" | "selected" | "disabled" | "rangeStart" | "rangeMiddle" | "rangeEnd";

const ARROW_DELTAS: Partial<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

function cellKind(ymd: string, mode: "single" | "range", { start, end }: DateRange, min?: string): CellKind {
  if (min && ymd < min) return "disabled";
  if (mode === "range" && start && end && end > start) {
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

type DatePickerProps = Readonly<{
  /** `range`: 한 달력에서 시작·종료를 고른다(하나만 고르면 하루). `single`은 `value.start`만 쓴다 */
  mode?: "single" | "range";
  value: DateRange;
  /** 이보다 이른 날짜는 고를 수 없다 (`YYYY-MM-DD`) */
  min?: string;
  onSelect: (ymd: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}>;

/** Figma Design System `09 Date Picker` — Header / Weekday / Date(또는 연월 휠) / Footer */
export function DatePicker({ mode = "range", value, min, onSelect, onCancel, onConfirm }: DatePickerProps) {
  const [todayYmd] = useState(() => formatDateYmd(new Date()));
  const initialFocus = value.start || (min && todayYmd < min ? min : todayYmd);
  const [view, setView] = useState<YearMonth>(() => toYearMonth(initialFocus));
  const [focusYmd, setFocusYmd] = useState(initialFocus);
  /** 연월 휠을 연 시점의 달 — 휠에서 취소하면 되돌린다 */
  const [wheelOrigin, setWheelOrigin] = useState<YearMonth | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const moveFocusRef = useRef(true);

  const minMonth = min ? toYearMonth(min) : undefined;
  const canGoPrev = !minMonth || monthIndex(view) > monthIndex(minMonth);
  const weeks = buildMonthWeeks(view);
  const days = weeks.flat().filter((ymd) => ymd != null);
  // 방향키 이동용 roving tabindex — 다른 달을 보고 있으면 그 달 1일
  const tabbableYmd = days.includes(focusYmd) ? focusYmd : days[0]!;
  const thisYear = Number(todayYmd.slice(0, 4));
  const summary = formatSelectionSummary(mode === "single" ? { start: value.start, end: "" } : value);

  // 처음 열릴 때와 방향키로 이동했을 때만 날짜 칸으로 포커스를 옮긴다
  useEffect(() => {
    if (!moveFocusRef.current) return;
    moveFocusRef.current = false;
    gridRef.current?.querySelector<HTMLElement>(`[data-ymd="${tabbableYmd}"]`)?.focus();
  }, [tabbableYmd]);

  function goToMonth(next: YearMonth) {
    if (minMonth && monthIndex(next) < monthIndex(minMonth)) return;
    setView(next);
  }

  function handleDayKeyDown(event: KeyboardEvent<HTMLButtonElement>, ymd: string) {
    const delta = ARROW_DELTAS[event.key];
    if (delta == null) return;
    event.preventDefault();
    const next = addDays(ymd, delta);
    const nextMonth = toYearMonth(next);
    if (minMonth && monthIndex(nextMonth) < monthIndex(minMonth)) return;
    moveFocusRef.current = true;
    setFocusYmd(next);
    setView(nextMonth);
  }

  return (
    <div className="flex w-[353px] min-w-0 max-w-full flex-col items-center gap-2 rounded-[12px] bg-fill-subtle p-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
      <div className="flex h-11 w-full items-center justify-between pl-3">
        <div className="flex min-w-0 flex-col items-start justify-center gap-1">
          <button
            type="button"
            aria-expanded={wheelOrigin != null}
            aria-label={`${view.year}년 ${view.month + 1}월, 연도와 월 선택`}
            onClick={() => setWheelOrigin((origin) => (origin ? null : view))}
            className="flex items-center gap-1 rounded text-title-s text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {view.year}년 {view.month + 1}월
            <ChevronDownIcon size={16} className="text-icon" />
          </button>
          <p aria-live="polite" className="text-caption-m-regular text-text-subtle">
            {summary}
          </p>
        </div>
        <div className="flex shrink-0">
          <button
            type="button"
            aria-label="이전 달"
            disabled={!canGoPrev}
            onClick={() => goToMonth(addMonths(view, -1))}
            className="flex size-11 items-center justify-center rounded-full text-icon focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary disabled:text-icon-disabled"
          >
            <ChevronLeftIcon size={20} />
          </button>
          <button
            type="button"
            aria-label="다음 달"
            onClick={() => goToMonth(addMonths(view, 1))}
            className="flex size-11 items-center justify-center rounded-full text-icon focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary"
          >
            <ChevronRightIcon size={20} />
          </button>
        </div>
      </div>

      {wheelOrigin ? (
        <MonthYearWheel
          value={view}
          min={minMonth}
          fromYear={Math.min(minMonth?.year ?? thisYear - 1, view.year)}
          toYear={Math.max(thisYear + 5, view.year)}
          onChange={goToMonth}
        />
      ) : (
        <>
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
            ref={gridRef}
            role="grid"
            aria-label={`${view.year}년 ${view.month + 1}월`}
            className="flex w-full max-w-[313px] flex-col gap-1"
          >
            {weeks.map((week) => (
              <div key={week.find(Boolean)} role="row" className="flex w-full">
                {week.map((ymd, index) =>
                  ymd ? (
                    <DateCell
                      key={ymd}
                      ymd={ymd}
                      kind={cellKind(ymd, mode, value, min)}
                      isToday={ymd === todayYmd}
                      tabbable={ymd === tabbableYmd}
                      onSelect={(selected) => {
                        setFocusYmd(selected);
                        onSelect(selected);
                      }}
                      onKeyDown={handleDayKeyDown}
                    />
                  ) : (
                    <div key={`empty-${index}`} role="gridcell" className="h-11 min-w-0 flex-1" />
                  ),
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="flex h-11 w-full items-center gap-1 px-1">
        <button
          type="button"
          onClick={() => {
            if (!wheelOrigin) {
              onCancel();
              return;
            }
            setView(wheelOrigin);
            setWheelOrigin(null);
          }}
          className="flex-1 rounded-md bg-fill-subtle px-2.5 py-2 text-label-m-emphasis text-text transition-colors hover:bg-fill hover:text-text-subtle active:bg-fill-strong active:text-text"
        >
          취소
        </button>
        <button
          type="button"
          onClick={() => {
            if (wheelOrigin) setWheelOrigin(null);
            else onConfirm();
          }}
          disabled={!wheelOrigin && !value.start}
          className="flex-1 rounded-md bg-[var(--gray-800)] px-2.5 py-2 text-label-m-emphasis text-text-inverse transition-colors enabled:hover:bg-[var(--gray-700)] enabled:active:bg-[var(--gray-900)] disabled:bg-fill disabled:text-text-disabled"
        >
          확인
        </button>
      </div>
    </div>
  );
}
