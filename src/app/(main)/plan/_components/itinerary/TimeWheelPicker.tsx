"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import { cn } from "@/lib/utils";

const ITEM_HEIGHT = 40;
const VISIBLE_ROWS = 5;
const CENTER_INDEX = Math.floor(VISIBLE_ROWS / 2);
const CONTAINER_HEIGHT = VISIBLE_ROWS * ITEM_HEIGHT;
const CENTER_PADDING = CENTER_INDEX * ITEM_HEIGHT;
const SCROLL_SETTLE_MS = 110;

type WheelColumnProps = {
  items: number[];
  value: number;
  onChange: (next: number) => void;
  ariaLabel: string;
  disabled?: boolean;
};

function nearestIndex(items: number[], value: number): number {
  let best = 0;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (let i = 0; i < items.length; i += 1) {
    const d = Math.abs(items[i]! - value);
    if (d < bestDelta) {
      best = i;
      bestDelta = d;
    }
  }
  return best;
}

function WheelColumn({
  items,
  value,
  onChange,
  ariaLabel,
  disabled = false,
}: WheelColumnProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const settleTimerRef = useRef<number | null>(null);
  const suppressScrollRef = useRef(false);

  const selectedIndex = nearestIndex(items, value);

  const scrollToIndex = useCallback((index: number, smooth: boolean) => {
    const el = scrollRef.current;
    if (!el) return;
    const target = index * ITEM_HEIGHT;
    if (Math.abs(el.scrollTop - target) < 0.5) return;
    suppressScrollRef.current = true;
    el.scrollTo({ top: target, behavior: smooth ? "smooth" : "auto" });
    window.setTimeout(() => {
      suppressScrollRef.current = false;
    }, smooth ? 260 : 40);
  }, []);

  useEffect(() => {
    scrollToIndex(selectedIndex, false);
  }, [selectedIndex, scrollToIndex]);

  useEffect(() => {
    return () => {
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
      }
    };
  }, []);

  const commit = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(items.length - 1, index));
      onChange(items[clamped]!);
    },
    [items, onChange],
  );

  const handleScroll = () => {
    if (suppressScrollRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
    }
    settleTimerRef.current = window.setTimeout(() => {
      const idx = Math.round(el.scrollTop / ITEM_HEIGHT);
      commit(idx);
    }, SCROLL_SETTLE_MS);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      commit(selectedIndex - 1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      commit(selectedIndex + 1);
    } else if (e.key === "PageUp") {
      e.preventDefault();
      commit(selectedIndex - 5);
    } else if (e.key === "PageDown") {
      e.preventDefault();
      commit(selectedIndex + 5);
    } else if (e.key === "Home") {
      e.preventDefault();
      commit(0);
    } else if (e.key === "End") {
      e.preventDefault();
      commit(items.length - 1);
    }
  };

  return (
    <div
      ref={scrollRef}
      role="listbox"
      aria-label={ariaLabel}
      aria-activedescendant={`${ariaLabel}-${items[selectedIndex]}`}
      tabIndex={disabled ? -1 : 0}
      onScroll={disabled ? undefined : handleScroll}
      onKeyDown={handleKeyDown}
      className={cn(
        "w-14 snap-y snap-mandatory overflow-y-scroll outline-none",
        "[&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]",
        "rounded-lg focus-visible:ring-2 focus-visible:ring-primary/40",
        disabled && "pointer-events-none opacity-60",
      )}
      style={{
        height: CONTAINER_HEIGHT,
        maskImage:
          "linear-gradient(to bottom, transparent 0%, #000 22%, #000 78%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent 0%, #000 22%, #000 78%, transparent 100%)",
      }}
    >
      <div style={{ paddingTop: CENTER_PADDING, paddingBottom: CENTER_PADDING }}>
        {items.map((v, i) => {
          const isSelected = i === selectedIndex;
          return (
            <button
              type="button"
              key={v}
              id={`${ariaLabel}-${v}`}
              role="option"
              aria-selected={isSelected}
              tabIndex={-1}
              onClick={() => commit(i)}
              className={cn(
                "flex w-full snap-center items-center justify-center text-xl font-semibold tabular-nums transition-colors",
                isSelected ? "text-gray-900" : "text-dark-gray/50",
              )}
              style={{ height: ITEM_HEIGHT }}
            >
              {String(v).padStart(2, "0")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type TimeWheelValue = { hour: number; minute: number };

type TimeWheelPickerProps = {
  value: TimeWheelValue;
  onChange: (next: TimeWheelValue) => void;
  disabled?: boolean;
};

export function TimeWheelPicker({
  value,
  onChange,
  disabled,
}: TimeWheelPickerProps) {
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);

  return (
    <div className="relative isolate flex items-center justify-center gap-2">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 z-0 rounded-xl bg-primary/[0.08] ring-1 ring-primary/25"
        style={{
          top: CENTER_INDEX * ITEM_HEIGHT,
          height: ITEM_HEIGHT,
        }}
      />
      <div className="relative z-10 flex items-center gap-2">
        <WheelColumn
          items={hours}
          value={value.hour}
          onChange={(h) => onChange({ hour: h, minute: value.minute })}
          ariaLabel="시"
          disabled={disabled}
        />
        <span
          aria-hidden
          className="pt-[2px] text-xl font-semibold text-gray-400"
        >
          :
        </span>
        <WheelColumn
          items={minutes}
          value={value.minute}
          onChange={(m) => onChange({ hour: value.hour, minute: m })}
          ariaLabel="분"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
