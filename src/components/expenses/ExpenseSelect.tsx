"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export function ExpenseSelect({
  label,
  name,
  value,
  options,
  onChange,
  placeholder = "선택",
  disabled = false,
}: {
  label: string;
  name?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();
  const isOpen = open && !disabled;
  const activeIndex = Math.min(active, options.length - 1);
  const selected = options.find((option) => option.value === value);
  function show() {
    setActive(
      Math.max(
        0,
        options.findIndex((option) => option.value === value),
      ),
    );
    setOpen(true);
  }
  function choose(next: string) {
    if (disabled) return;
    onChange(next);
    setOpen(false);
    trigger.current?.focus();
  }
  useEffect(() => {
    const element = root.current;
    if (!isOpen || !element) return;
    const outside = (event: PointerEvent) => {
      if (!element.contains(event.target as Node)) setOpen(false);
    };
    element.ownerDocument.addEventListener("pointerdown", outside);
    return () =>
      element.ownerDocument.removeEventListener("pointerdown", outside);
  }, [isOpen]);
  useEffect(() => {
    if (isOpen)
      list.current?.children[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [isOpen, activeIndex]);
  return (
    <div
      ref={root}
      className="relative min-w-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        name={name}
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? id : undefined}
        aria-activedescendant={
          isOpen && options[activeIndex] ? id + "-" + activeIndex : undefined
        }
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            if (isOpen) setOpen(false);
            else show();
          }
        }}
        onKeyDown={(event) => {
          if (disabled || event.nativeEvent.isComposing) return;
          if (event.key === "Escape" && isOpen) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!isOpen) show();
            else
              setActive(
                Math.max(
                  0,
                  Math.min(
                    options.length - 1,
                    activeIndex + (event.key === "ArrowDown" ? 1 : -1),
                  ),
                ),
              );
          } else if (isOpen && (event.key === "Home" || event.key === "End")) {
            event.preventDefault();
            setActive(event.key === "Home" ? 0 : options.length - 1);
          } else if (isOpen && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            if (options[activeIndex]) choose(options[activeIndex].value);
          }
        }}
        className="flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-gray-border bg-white px-3 py-2 text-left text-sm font-medium cursor-pointer transition-colors enabled:hover:border-primary/40 enabled:hover:bg-gray-50 aria-expanded:border-primary/50 aria-expanded:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="min-w-0 break-words">
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <div
          ref={list}
          id={id}
          role="listbox"
          aria-label={label}
          className="absolute inset-x-0 top-full z-30 mt-2 max-h-60 overflow-y-auto overscroll-contain rounded-xl border border-gray-border bg-white p-1.5 shadow-lg"
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              id={id + "-" + index}
              type="button"
              role="option"
              aria-selected={value === option.value}
              tabIndex={-1}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option.value)}
              className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium cursor-pointer transition-colors hover:bg-primary/10 ${index === activeIndex ? "bg-primary/5" : ""}`}
            >
              <span className="min-w-0 break-words">{option.label}</span>
              {value === option.value && (
                <Check
                  size={16}
                  aria-hidden="true"
                  className="shrink-0 text-primary"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
