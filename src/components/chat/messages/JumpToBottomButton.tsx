"use client";

import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function JumpToBottomButton({
  onClick,
  isMinimized = false,
  scrollbarWidth = 0,
}: {
  onClick: () => void;
  isMinimized?: boolean;
  /** 메시지 목록 스크롤바 폭 — 버튼을 스크롤바 바깥(왼쪽)에 둔다 */
  scrollbarWidth?: number;
}) {
  return (
    <div
      className="pointer-events-none absolute bottom-3 z-10"
      style={{ right: 12 + scrollbarWidth }}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label="가장 아래로 이동"
        className={cn(
          "pointer-events-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-black/[0.08] bg-white text-black/80 shadow-md transition hover:bg-light-gray",
          isMinimized && "h-8 w-8",
        )}
      >
        <ArrowDown
          className={cn(isMinimized ? "h-4 w-4" : "h-[18px] w-[18px]")}
          strokeWidth={2}
          aria-hidden
        />
      </button>
    </div>
  );
}
