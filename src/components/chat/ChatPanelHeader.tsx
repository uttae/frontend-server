import { Maximize2, Minimize2, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

interface ChatPanelHeaderProps {
  roomTitle: string;
  onlineCount: number;
  isMinimized: boolean;
  onMaximize: () => void;
  onMinimize: () => void;
  onClose: () => void;
}

export function ChatPanelHeader({
  roomTitle,
  onlineCount,
  isMinimized,
  onMaximize,
  onMinimize,
  onClose,
}: ChatPanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-between border-b border-gray-300 bg-primary px-3 py-2 text-white",
        isMinimized ? "cursor-pointer" : "",
      )}
      onClick={isMinimized ? onMaximize : undefined}
    >
      <div className="min-w-0 flex-1">
        <h2
          className={cn(
            "truncate font-semibold leading-tight text-white transition-all duration-300",
            isMinimized ? "text-[14px]" : "text-2xl",
          )}
        >
          {roomTitle}
        </h2>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "shrink-0 rounded-full bg-[#4ade80] transition-all duration-300",
              isMinimized ? "h-1.5 w-1.5" : "h-2.5 w-2.5",
            )}
          />
          <span
            className={cn(
              "font-semibold text-white/85 transition-all duration-300",
              isMinimized ? "text-xs leading-tight" : "text-[14px]",
            )}
          >
            {onlineCount}명 접속중
          </span>
        </div>
      </div>

      <div
        className="flex shrink-0 items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={isMinimized ? onMaximize : onMinimize}
          className="cursor-pointer rounded-full p-1.5 text-white transition hover:bg-white/15"
          aria-label={isMinimized ? "최대화" : "최소화"}
        >
          {isMinimized ? (
            <Maximize2 className="h-4 w-4" strokeWidth={3} aria-hidden />
          ) : (
            <Minimize2 className="h-4 w-4" strokeWidth={3} aria-hidden />
          )}
        </button>
        <button
          onClick={onClose}
          className="cursor-pointer rounded-full p-1.5 text-white transition hover:bg-white/15"
          aria-label="채팅 닫기"
        >
          <Minus className="h-4 w-4" strokeWidth={3} aria-hidden />
        </button>
      </div>
    </div>
  );
}
