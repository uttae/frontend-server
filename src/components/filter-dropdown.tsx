"use client";

import { useEffect, useId, useRef, useState } from "react";

import { createPortal } from "react-dom";
import { MapSearchIcon } from "@/components/map/MapSearchIcon";
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
  const menuId = useId();
  const focusMenuOnOpen = useRef(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    if (focusMenuOnOpen.current) menuRef.current?.querySelector("button")?.focus();
    const dismissOutside = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const dismissOnMove = (event: Event) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener("mousedown", dismissOutside);
    document.addEventListener("keydown", escape);
    window.addEventListener("scroll", dismissOnMove, true);
    window.addEventListener("resize", dismissOnMove);
    return () => {
      document.removeEventListener("mousedown", dismissOutside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("scroll", dismissOnMove, true);
      window.removeEventListener("resize", dismissOnMove);
    };
  }, [open]);

  const isActive = value !== "all";
  const selectedLabel = options.find((o) => o.value === value)?.label ?? label;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) { event.preventDefault(); triggerRef.current?.click(); }
        }}
        aria-label={`${label} 필터`}
        onClick={(event) => {
          focusMenuOnOpen.current = event.detail === 0;
          const rect = triggerRef.current?.getBoundingClientRect();
          if (rect) setPosition({ top: rect.bottom + 4, left: Math.max(8, Math.min(rect.left, window.innerWidth - 144)) });
          setOpen((prev) => !prev);
        }}
        className={cn(
          "flex items-center gap-1",
          isActive
            ? mapFilterChipActiveRingClassName()
            : mapFilterChipInactiveClassName(),
        )}
      >
        <span>{isActive ? selectedLabel : label}</span>
        <MapSearchIcon name="chevron-down" className={cn("shrink-0 transition-transform", open && "rotate-180")}/>
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          style={position}
          className={cn(
            "fixed min-w-[136px] overflow-hidden rounded-xl border border-gray-border bg-white shadow-lg",
            menuClassName ?? "z-30",
          )}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
                triggerRef.current?.focus();
              }}
              className={cn(
                "w-full cursor-pointer px-3 py-2 text-left text-label-m-regular mobile:text-label-s-regular transition hover:bg-gray-50",
                value === opt.value
                  ? "font-semibold text-primary"
                  : "text-black",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>, document.body,
      )}
    </div>
  );
}
