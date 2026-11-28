import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";

import { formatDateYmd } from "@/lib/plan/tripRange";

import { addDays, addMonths, monthIndex, toYearMonth, type DateRange, type YearMonth } from "./calendar";

const ARROW_DELTAS: Partial<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

type ViewState = { view: YearMonth; focusYmd: string };

function monthStartYmd({ year, month }: YearMonth): string {
  return formatDateYmd(new Date(year, month, 1));
}

function viewShowing(view: YearMonth, target: YearMonth, monthCount: number): YearMonth {
  const offset = monthIndex(target) - monthIndex(view);
  if (offset < 0) return target;
  if (offset >= monthCount) return addMonths(target, 1 - monthCount);
  return view;
}

export type CalendarView = ReturnType<typeof useCalendarView>;

export function useCalendarView({
  value,
  min,
  monthCount,
  gridsRef,
  onSelect,
}: {
  value: DateRange;
  min?: string;
  monthCount: 1 | 2;
  gridsRef: RefObject<HTMLElement | null>;
  onSelect: (ymd: string) => void;
}) {
  const [todayYmd] = useState(() => formatDateYmd(new Date()));
  const [state, setState] = useState<ViewState>(() => {
    const focusYmd = value.start || (min && todayYmd < min ? min : todayYmd);
    return { view: toYearMonth(focusYmd), focusYmd };
  });
  const moveFocusRef = useRef(true);

  const minMonth = min ? toYearMonth(min) : undefined;
  const months = Array.from({ length: monthCount }, (_, offset) => addMonths(state.view, offset));
  const focusOffset = monthIndex(toYearMonth(state.focusYmd)) - monthIndex(state.view);
  const tabbableYmd = focusOffset >= 0 && focusOffset < monthCount ? state.focusYmd : monthStartYmd(state.view);

  useEffect(() => {
    if (!moveFocusRef.current) return;
    moveFocusRef.current = false;
    gridsRef.current?.querySelector<HTMLElement>(`[data-ymd="${tabbableYmd}"]`)?.focus();
  }, [gridsRef, tabbableYmd]);

  function showView(view: YearMonth) {
    if (minMonth && monthIndex(view) < monthIndex(minMonth)) return;
    setState((current) => ({ ...current, view }));
  }

  return {
    value,
    min,
    todayYmd,
    minMonth,
    months,
    tabbableYmd,
    canGoPrev: !minMonth || monthIndex(state.view) > monthIndex(minMonth),
    showView,
    shiftView(delta: number) {
      showView(addMonths(state.view, delta));
    },
    selectDay(ymd: string) {
      setState((current) => ({ ...current, focusYmd: ymd }));
      onSelect(ymd);
    },
    handleDayKeyDown(event: KeyboardEvent<HTMLButtonElement>, ymd: string) {
      const delta = ARROW_DELTAS[event.key];
      if (delta == null) return;
      event.preventDefault();
      const next = addDays(ymd, delta);
      const nextMonth = toYearMonth(next);
      if (minMonth && monthIndex(nextMonth) < monthIndex(minMonth)) return;
      moveFocusRef.current = true;
      setState((current) => ({ focusYmd: next, view: viewShowing(current.view, nextMonth, monthCount) }));
    },
  };
}
