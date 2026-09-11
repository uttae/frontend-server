"use client";

import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { expenseInputClass, formatExpenseAmount } from "./ExpenseViews";

export function ExpenseAmountInput({
  value,
  onChange,
  placeholder,
  fractionDigits,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  fractionDigits?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const formatted = formatExpenseAmount(value);
  useLayoutEffect(() => {
    if (caret.current === null || !input.current) return;
    let count = 0,
      position = 0;
    while (position < formatted.length && count < caret.current) {
      if (formatted[position] !== ",") count++;
      position++;
    }
    input.current.setSelectionRange(position, position);
    caret.current = null;
  }, [formatted]);
  return (
    <input
      ref={input}
      className={cn(expenseInputClass, "block h-14 font-bold tabular-nums")}
      inputMode="decimal"
      value={formatted}
      placeholder={placeholder}
      autoComplete="off"
      onBlur={() => {
        caret.current = null;
        if (
          fractionDigits === undefined ||
          !Number.isInteger(fractionDigits) ||
          fractionDigits < 0 ||
          !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)
        )
          return;
        // Work on decimal strings: pad or truncate, never round via floating point.
        const [integer, fraction = ""] = value.split(".");
        const normalized =
          (integer || "0") +
          (fractionDigits
            ? "." +
              fraction.padEnd(fractionDigits, "0").slice(0, fractionDigits)
            : "");
        if (normalized !== value) onChange(normalized);
      }}
      onChange={(event) => {
        const element = event.target;
        caret.current =
          element.selectionStart === null ||
          element.selectionStart === undefined
            ? null
            : element.value.slice(0, element.selectionStart).replaceAll(",", "")
                .length;
        onChange(element.value.replaceAll(",", ""));
      }}
      onKeyDown={(event) => {
        const element = event.currentTarget;
        const start = element.selectionStart;
        if (
          start === null ||
          start !== element.selectionEnd ||
          event.nativeEvent.isComposing
        )
          return;
        // Treat separators as formatting when deleting, rather than reinserting them forever.
        if (event.key === "Backspace" && element.value[start - 1] === ",")
          element.setSelectionRange(start - 1, start - 1);
        if (event.key === "Delete" && element.value[start] === ",")
          element.setSelectionRange(start + 1, start + 1);
      }}
    />
  );
}
