"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { TimeParts } from "@/lib/plan/timePickerDraft";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };
const PERIOD_OPTIONS: Option[] = [{ value: "AM", label: "오전" }, { value: "PM", label: "오후" }];
const HOUR_OPTIONS: Option[] = Array.from({ length: 12 }, (_, i) => ({ value: String((i + 1) % 12), label: String(i + 1) }));
const MINUTE_OPTIONS: Option[] = Array.from({ length: 60 }, (_, i) => ({ value: String(i), label: String(i).padStart(2, "0") }));
const ROW_HEIGHT = 40;

/** Figma 5065:3515: five flat 40px rows; the selected band is independently 44px. */
function TimeWheelColumn({ label, options, value, preview, active, cyclic, onSelect, onScrollingChange }: Readonly<{
  label: string;
  options: Option[];
  value: string | null;
  preview: string;
  active: boolean;
  cyclic: boolean;
  onSelect: (value: string) => void;
  onScrollingChange: (label: string, scrolling: boolean) => void;
}>) {
  const id = useId();
  const scroller = useRef<HTMLDivElement>(null);
  const userScroll = useRef(false);
  const gestureStartTop = useRef(0);
  const alignedIndex = options.findIndex(option => option.value === (value ?? preview));
  const targetIndex = (cyclic ? options.length : 0) + alignedIndex;
  const [centerIndex, setCenterIndex] = useState(targetIndex);
  const rows = cyclic ? [...options, ...options, ...options] : options;

  useLayoutEffect(() => {
    // Alignment on opening, field switching, or reset must never count as input.
    userScroll.current = false;
    onScrollingChange(label, false);
    if (scroller.current) scroller.current.scrollTop = targetIndex * ROW_HEIGHT;
  }, [targetIndex, label, onScrollingChange]);

  useEffect(() => () => onScrollingChange(label, false), [label, onScrollingChange]);

  function beginScroll() {
    if (!active || userScroll.current) return;
    gestureStartTop.current = scroller.current?.scrollTop ?? 0;
    userScroll.current = true;
  }

  function select(index: number) {
    const row = rows[index];
    if (!active || !row) return;
    userScroll.current = false;
    onScrollingChange(label, false);
    const centered = cyclic ? options.length + index % options.length : index;
    setCenterIndex(centered);
    if (scroller.current) scroller.current.scrollTop = centered * ROW_HEIGHT;
    onSelect(row.value);
  }

  return (
    <div
      ref={scroller}
      role="listbox"
      aria-label={label}
      aria-disabled={!active}
      aria-activedescendant={`${id}-${centerIndex}`}
      tabIndex={active ? 0 : -1}
      className="relative h-[200px] snap-y snap-mandatory overflow-y-auto overscroll-contain py-[80px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:outline-2 focus-visible:outline-primary"
      onPointerDown={beginScroll}
      onTouchStart={beginScroll}
      onWheel={beginScroll}
      onScroll={event => {
        setCenterIndex(Math.max(0, Math.min(rows.length - 1, Math.round(event.currentTarget.scrollTop / ROW_HEIGHT))));
        if (active && userScroll.current) onScrollingChange(label, true);
      }}
      onScrollEnd={event => {
        if (!active || !userScroll.current) return;
        if (Math.abs(event.currentTarget.scrollTop - gestureStartTop.current) < ROW_HEIGHT / 2) {
          userScroll.current = false;
          onScrollingChange(label, false);
          return;
        }
        const index = Math.max(0, Math.min(rows.length - 1, Math.round(event.currentTarget.scrollTop / ROW_HEIGHT)));
        select(index);
      }}
      onKeyDown={event => {
        const offset = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
        if (!active || (!offset && event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        select(Math.max(0, Math.min(rows.length - 1, centerIndex + offset)));
      }}
    >
      {rows.map((option, index) => (
        <button
          key={`${index}-${option.value}`}
          id={`${id}-${index}`}
          type="button"
          role="option"
          data-value={option.value}
          aria-selected={value === option.value && index === centerIndex}
          tabIndex={-1}
          disabled={!active}
          onClick={() => select(index)}
          className={cn(
            "flex h-[40px] w-full shrink-0 snap-center items-center justify-center select-none",
            index === centerIndex ? "text-body-l-emphasis" : "text-body-l-regular",
            !active ? "text-text-disabled" : index === centerIndex ? "text-text" : "text-text-subtle",
          )}
        >{option.label}</button>
      ))}
    </div>
  );
}

/** Preview alignment is visual only. Each missing column requires a user selection. */
export function TimeWheelPicker({ value, onChange, active, onSettlingChange }: Readonly<{
  value: TimeParts;
  onChange: (parts: TimeParts) => void;
  active: boolean;
  onSettlingChange: (settling: boolean) => void;
}>) {
  const scrollingColumns = useRef(new Set<string>());
  const reportScrolling = useCallback((label: string, scrolling: boolean) => {
    if (scrolling) scrollingColumns.current.add(label);
    else scrollingColumns.current.delete(label);
    onSettlingChange(scrollingColumns.current.size > 0);
  }, [onSettlingChange]);
  return (
    <div className="relative flex min-w-[300px] w-full justify-center gap-2 px-4 py-2" inert={!active}>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 h-11 -translate-y-1/2 rounded-md bg-fill" />
      <div className="w-[88px] shrink-0">
        <TimeWheelColumn label="오전/오후" options={PERIOD_OPTIONS} value={value.period} preview="AM" active={active} cyclic={false} onScrollingChange={reportScrolling}
          onSelect={period => { if (period === "AM" || period === "PM") onChange({ ...value, period }); }} />
      </div>
      <div className="w-16 shrink-0">
        <TimeWheelColumn label="시" options={HOUR_OPTIONS} value={value.hour === null ? null : String(value.hour)} preview="10" active={active} cyclic onScrollingChange={reportScrolling}
          onSelect={hour => onChange({ ...value, hour: Number(hour) })} />
      </div>
      <div className="w-16 shrink-0">
        <TimeWheelColumn label="분" options={MINUTE_OPTIONS} value={value.minute === null ? null : String(value.minute)} preview="0" active={active} cyclic onScrollingChange={reportScrolling}
          onSelect={minute => onChange({ ...value, minute: Number(minute) })} />
      </div>
    </div>
  );
}
