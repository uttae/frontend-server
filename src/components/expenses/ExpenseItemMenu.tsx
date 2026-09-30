"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { TrashIcon, WriteIcon } from "@/assets/icons";

export function ExpenseItemMenu({
  label,
  busy,
  onEdit,
  onDelete,
}: Readonly<{
  label: string;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}>) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open || !root.current) return;
    const element = root.current;
    const outside = (event: PointerEvent) => {
      if (!element.contains(event.target as Node)) setOpen(false);
    };
    element.ownerDocument.addEventListener("pointerdown", outside);
  return () =>
      element.ownerDocument.removeEventListener("pointerdown", outside);
  }, [open]);
  function choose(action: () => void) {
    if (busy) return;
    trigger.current?.focus();
    setOpen(false);
    action();
  }
  function handleEscape(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "Escape" || !open) return;
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
    trigger.current?.focus();
  }
  return (
    <div
      ref={root}
      className="relative z-20 self-start"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}

    >
      <button
        ref={trigger}
        type="button"
        onKeyDown={handleEscape}
        aria-label={`${label} 비용 더보기`}
        aria-expanded={open && !busy}
        aria-controls={open && !busy ? id : undefined}
        disabled={busy}
        onClick={() => setOpen(!open)}
        className="flex size-8 @min-[800px]/expense-list:w-6 cursor-pointer items-center justify-center rounded-md text-text-subtle hover:bg-fill focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local Figma vector asset */}
        <img src="/expenses/more.svg" alt="" className="max-w-none" />
      </button>
      {open && !busy && (
        <div
          id={id}
          className="absolute right-0 top-8 z-30 w-40 rounded-lg border border-border-subtle bg-white py-1 shadow-lg"
        >
          <button
            type="button"
        onKeyDown={handleEscape}
            aria-label="비용 수정"
            onClick={() => choose(onEdit)}
            className="flex min-h-11 w-full cursor-pointer items-center gap-2 px-4 text-body-s-regular hover:bg-fill focus-visible:outline-primary"
          >
            <WriteIcon size={16} />
            수정
          </button>
          <button
            type="button"
        onKeyDown={handleEscape}
            aria-label="비용 삭제"
            onClick={() => choose(onDelete)}
            className="flex min-h-11 w-full cursor-pointer items-center gap-2 px-4 text-body-s-regular text-status-negative hover:bg-fill focus-visible:outline-primary"
          >
            <TrashIcon size={16} />
            삭제
          </button>
        </div>
      )}
    </div>
  );
}
