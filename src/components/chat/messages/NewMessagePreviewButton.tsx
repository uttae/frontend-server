"use client";

import { UserAvatar } from "@/components/user/UserAvatar";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types/chat";

export const PLACE_SHARE_PREVIEW_TEXT = "장소를 공유했습니다.";

/** 위로 스크롤한 상태에서 새 메시지 도착 시 하단 미리보기 — 누르면 최하단으로 */
export function NewMessagePreviewButton({
  message,
  onClick,
  isMinimized = false,
  scrollbarWidth = 0,
}: {
  message: ChatMessage;
  onClick: () => void;
  isMinimized?: boolean;
  /** 메시지 목록 스크롤바 폭 — 스크롤바를 뺀 영역 기준으로 가운데 정렬 */
  scrollbarWidth?: number;
}) {
  const text =
    message.type === "place" ? PLACE_SHARE_PREVIEW_TEXT : message.text;

  return (
    <div
      className="pointer-events-none absolute bottom-3 left-3 z-10 flex justify-center"
      style={{ right: 12 + scrollbarWidth }}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={`${message.sender ?? ""}님의 새 메시지: ${text}. 가장 아래로 이동`}
        className={cn(
          "pointer-events-auto flex min-w-0 max-w-full cursor-pointer items-center gap-2 rounded-xl bg-background-strong py-1.5 pl-1.5 pr-3.5 text-left shadow-md transition hover:brightness-[0.98]",
          isMinimized && "gap-1.5 py-1 pl-1 pr-3",
        )}
      >
        <UserAvatar
          // 방을 나간 사람은 사진이 있어도 사람 아이콘을 보인다
          user={{
            nickname: message.sender ?? "",
            profileImageUrl: message.senderNotInRoom ? null : (message.avatar ?? null),
          }}
          size={isMinimized ? 24 : 28}
          shape="rounded"
          tone="icon"
          ring="default"
        />
        <span
          className={cn(
            "shrink-0 text-primary",
            isMinimized ? "text-body-xs-emphasis" : "text-body-s-emphasis",
          )}
        >
          {message.sender}
        </span>
        <span
          className={cn(
            "min-w-0 truncate text-text",
            isMinimized ? "text-body-xs-regular" : "text-body-s-regular",
          )}
        >
          {text}
        </span>
      </button>
    </div>
  );
}
