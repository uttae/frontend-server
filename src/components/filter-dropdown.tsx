"use client";

import { useEffect, useRef, useState } from "react";

import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import { cn } from "@/lib/utils";

import {
  mapFilterChipActiveRingClassName,
  mapFilterChipInactiveClassName,
} from "@/components/map/map-chip-button";

export type FilterOption<T extends string> = { label: string; value: T };

interface FilterDropdownProps<T extends string> {
  label: string;
  options: FilterOption<T>[];
  value: T;
  onChange: (v: T) => void;
  onOpenChange?: (open: boolean) => void;
  menuClassName?: string;
}

export function FilterDropdown<T extends string>({
  label,
  options,
  value,
  onChange,
  onOpenChange,
  menuClassName,
}: FilterDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  useOnClickOutside(ref, () => setOpen(false));

  const isActive = value !== "all";
  const selectedLabel = options.find((o) => o.value === value)?.label ?? label;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex items-center gap-1",
          isActive
            ? mapFilterChipActiveRingClassName()
            : mapFilterChipInactiveClassName(),
        )}
      >
        <span>{isActive ? selectedLabel : label}</span>
        <svg
          className={cn("h-3 w-3 transition-transform", open && "rotate-180")}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 4l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div
          className={cn(
            "absolute left-0 top-full mt-1.5 min-w-[136px] overflow-hidden rounded-xl border border-gray-border bg-white shadow-lg",
            menuClassName ?? "z-30",
          )}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={cn(
                "w-full cursor-pointer px-3 py-2 text-left text-[14px] transition hover:bg-gray-50",
                value === opt.value
                  ? "font-semibold text-primary"
                  : "text-black",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
