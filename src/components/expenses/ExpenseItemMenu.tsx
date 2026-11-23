"use client";
import { useRef, useState } from "react";
import { TrashIcon, WriteIcon } from "@/assets/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const trigger = useRef<HTMLButtonElement>(null);
  function choose(action: () => void) {
    trigger.current?.focus();
    action();
  }
  return (
    <DropdownMenu open={open && !busy} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        ref={trigger}
        aria-label={`${label} 비용 더보기`}
        disabled={busy}
        className="flex size-8 @min-[800px]/expense-list:w-6 cursor-pointer items-center justify-center rounded-md text-text-subtle hover:bg-fill focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/expenses/more.svg" alt="" className="max-w-none" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem aria-label="비용 수정" onClick={() => choose(onEdit)}>
          <WriteIcon />
          수정
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" aria-label="비용 삭제" onClick={() => choose(onDelete)}>
          <TrashIcon />
          삭제
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
