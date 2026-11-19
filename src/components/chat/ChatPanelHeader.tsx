import { ArrowMaximizeIcon, ArrowMinimizeIcon, CloseIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";

interface ChatPanelHeaderProps {
  isMinimized: boolean;
  onMaximize: () => void;
  onMinimize: () => void;
  onClose: () => void;
}

const iconButtonClass =
  "flex size-10 shrink-0 cursor-pointer items-center justify-center self-center rounded-md text-icon-subtle transition-colors hover:bg-fill hover:text-icon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function ChatPanelHeader({ isMinimized, onMaximize, onMinimize, onClose }: ChatPanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center bg-white py-3",
        isMinimized ? "min-h-16 pl-5 pr-2" : "min-h-19 pl-5 pr-3",
      )}
    >
      <div className="mr-auto flex min-w-0 flex-col gap-0.5">
        <h2 className="text-title-l text-text">채팅</h2>
        {isMinimized ? null : (
          <p className="text-body-s-regular text-text-subtle">친구들과 여행에 관한 이야기를 나누세요</p>
        )}
      </div>
      <button
        type="button"
        onClick={isMinimized ? onMaximize : onMinimize}
        className={iconButtonClass}
        aria-label={isMinimized ? "최대화" : "최소화"}
      >
        {isMinimized ? <ArrowMaximizeIcon /> : <ArrowMinimizeIcon />}
      </button>
      {isMinimized ? (
        <button type="button" onClick={onClose} className={iconButtonClass} aria-label="채팅 닫기">
          <CloseIcon />
        </button>
      ) : null}
    </div>
  );
}
