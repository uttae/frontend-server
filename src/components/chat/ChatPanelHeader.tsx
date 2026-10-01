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
    <div className="flex h-10 shrink-0 items-center gap-1 bg-white px-3">
      <h2 className="mr-auto text-[16px] font-semibold leading-6 text-text">채팅</h2>
      <button
        type="button"
        onClick={isMinimized ? onMaximize : onMinimize}
        className="flex size-7 cursor-pointer items-center justify-center rounded-md text-text-subtle transition-colors hover:bg-fill-default hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        aria-label={isMinimized ? "최대화" : "최소화"}
      >
        {isMinimized ? (
          <Maximize2 className="size-4" strokeWidth={2} aria-hidden />
        ) : (
          <Minimize2 className="size-4" strokeWidth={2} aria-hidden />
        )}
      </button>
      {isMinimized ? (
        <button
          type="button"
          onClick={onClose}
          className="flex size-7 cursor-pointer items-center justify-center rounded-md text-text-subtle transition-colors hover:bg-fill-default hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label="채팅 닫기"
        >
          <X className="size-4" strokeWidth={2} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
