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

export function ChatPanelHeader({
  isMinimized,
  onMaximize,
  onMinimize,
  onClose,
}: ChatPanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 bg-white py-3",
        // 최대화 헤더는 설명 줄이 없어 가운데로 맞추면 제목이 위에서 23에 온다. 다른 탭 제목(12)과 맞추려고 위로 붙인다
        isMinimized ? "min-h-16 items-center px-5" : "min-h-19 items-start pl-5 pr-3",
      )}
    >
      <h2 className="mr-auto text-title-l text-text">채팅</h2>
      <button
        type="button"
        onClick={isMinimized ? onMaximize : onMinimize}
        className={iconButtonClass}
        aria-label={isMinimized ? "최대화" : "최소화"}
      >
        {isMinimized ? <ArrowMaximizeIcon /> : <ArrowMinimizeIcon />}
      </button>
      {isMinimized ? (
        <button
          type="button"
          onClick={onClose}
          className={iconButtonClass}
          aria-label="채팅 닫기"
        >
          <CloseIcon />
        </button>
      ) : null}
    </div>
  );
}
