import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";

import { formatDateYmd } from "@/lib/plan/tripRange";

import { addDays, addMonths, monthIndex, toYearMonth, type DateRange, type YearMonth } from "./calendar";

const ARROW_DELTAS: Partial<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

type CalendarViewState = {
  view: YearMonth;
  focusYmd: string;
  wheel: { panel: number; origin: YearMonth } | null;
};

function monthStartYmd({ year, month }: YearMonth): string {
  return formatDateYmd(new Date(year, month, 1));
}

function tabbableDay({ view, focusYmd }: CalendarViewState, gridPanels: number[]): string | undefined {
  if (gridPanels.includes(monthIndex(toYearMonth(focusYmd)) - monthIndex(view))) return focusYmd;
  const firstGridPanel = gridPanels[0];
  return firstGridPanel === undefined ? undefined : monthStartYmd(addMonths(view, firstGridPanel));
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
  onCancel,
  onConfirm,
}: {
  value: DateRange;
  min?: string;
  monthCount: number;
  gridsRef: RefObject<HTMLElement | null>;
  onSelect: (ymd: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [todayYmd] = useState(() => formatDateYmd(new Date()));
  const [state, setState] = useState<CalendarViewState>(() => {
    const focusYmd = value.start || (min && todayYmd < min ? min : todayYmd);
    return { view: toYearMonth(focusYmd), focusYmd, wheel: null };
  });
  const moveFocusRef = useRef(true);

  const minMonth = min ? toYearMonth(min) : undefined;
  const months = Array.from({ length: monthCount }, (_, panel) => addMonths(state.view, panel));
  const tabbableYmd = tabbableDay(
    state,
    months.flatMap((_, panel) => (state.wheel?.panel === panel ? [] : [panel])),
  );

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
    minMonth,
    todayYmd,
    months,
    wheelPanel: state.wheel?.panel ?? null,
    canGoPrev: !minMonth || monthIndex(state.view) > monthIndex(minMonth),
    tabbableYmd,
    canConfirm: state.wheel != null || Boolean(value.start),
    shiftView(delta: number) {
      showView(addMonths(state.view, delta));
    },
    toggleWheel(panel: number) {
      setState((current) => ({
        ...current,
        wheel: current.wheel?.panel === panel ? null : { panel, origin: current.wheel?.origin ?? current.view },
      }));
    },
    pickWheelMonth(month: YearMonth) {
      if (state.wheel) showView(addMonths(month, -state.wheel.panel));
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
      setState((current) => ({
        ...current,
        focusYmd: next,
        view: viewShowing(current.view, nextMonth, monthCount),
      }));
    },
    cancel() {
      const { wheel } = state;
      if (!wheel) {
        onCancel();
        return;
      }
      setState((current) => ({ ...current, view: wheel.origin, wheel: null }));
    },
    confirm() {
      if (!state.wheel) {
        onConfirm();
        return;
      }
      setState((current) => ({ ...current, wheel: null }));
    },
  };
}
