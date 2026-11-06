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
  // 항목이 여는 대화상자(비용 편집·삭제 확인)가 닫힌 뒤 포커스가 이 트리거로 돌아오도록, 동작 전에 트리거로 먼저 옮긴다(지금 동작).
  // 메뉴 항목은 닫히면서 사라져 대화상자가 그 항목을 복귀 대상으로 잡으면 안 된다
  function choose(action: () => void) {
    trigger.current?.focus();
    action();
  }
  // 처리 중(busy)에는 트리거가 비활성이고 열려 있던 메뉴도 숨긴다(지금 동작)
  return (
    <DropdownMenu open={open && !busy} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        ref={trigger}
        aria-label={`${label} 비용 더보기`}
        disabled={busy}
        className="flex size-8 @min-[800px]/expense-list:w-6 cursor-pointer items-center justify-center rounded-md text-text-subtle hover:bg-fill focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local Figma vector asset */}
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
