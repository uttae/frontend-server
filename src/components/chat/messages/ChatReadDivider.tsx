"use client";

import { cn } from "@/lib/utils";

export function ChatReadDivider({ isMinimized = false }: { isMinimized?: boolean }) {
  return (
    <div
      data-chat-read-divider=""
      className={cn(
        "flex items-center gap-2 px-2 py-1",
        isMinimized && "gap-1.5 py-0.5",
      )}
      role="separator"
      aria-label="여기까지 읽었어요"
    >
      <span
        className={cn(
          "h-px min-w-0 flex-1 bg-black/15",
          isMinimized && "bg-black/12",
        )}
        aria-hidden
      />
      <span
        className={cn(
          "shrink-0 text-center text-body-s-regular text-black/45",
          isMinimized && "text-body-xs-regular",
        )}
      >
        여기까지 읽었어요
      </span>
      <span
        className={cn(
          "h-px min-w-0 flex-1 bg-black/15",
          isMinimized && "bg-black/12",
        )}
        aria-hidden
      />
    </div>
  );
}
