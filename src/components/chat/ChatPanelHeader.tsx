import { Maximize2, Minimize2, X } from "lucide-react";

interface ChatPanelHeaderProps {
  isMinimized: boolean;
  onMaximize: () => void;
  onMinimize: () => void;
  onClose: () => void;
}

export function ChatPanelHeader({
  isMinimized,
  onMaximize,
  onMinimize,
  onClose,
}: ChatPanelHeaderProps) {
  return (
    <div className="flex h-12 shrink-0 items-center justify-end gap-2 border-b border-border-subtle bg-fill-subtle px-3">
      <button
        type="button"
        onClick={isMinimized ? onMaximize : onMinimize}
        className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-border-subtle bg-white text-primary-strong transition-colors hover:bg-primary-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        aria-label={isMinimized ? "최대화" : "최소화"}
      >
        {isMinimized ? (
          <Maximize2 className="size-[18px]" strokeWidth={2} aria-hidden />
        ) : (
          <Minimize2 className="size-[18px]" strokeWidth={2} aria-hidden />
        )}
      </button>
      {isMinimized ? (
        <button
          type="button"
          onClick={onClose}
          className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-border-subtle bg-white text-text-subtle transition-colors hover:bg-fill-default hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label="채팅 닫기"
        >
          <X className="size-[18px]" strokeWidth={2} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
