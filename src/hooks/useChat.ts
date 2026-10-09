"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";

import { isChatPathname, CHAT_PATH } from "@/lib/mobile-view";
import type { ChatState } from "@/stores/chat-panel-store";
import { useChatPanelStore } from "@/stores/chat-panel-store";

export type { ChatState };

/** 돌아갈 기록이 없을 때(새 탭에서 `/chat`을 바로 연 경우) 갈 곳 */
const CHAT_FALLBACK_PATH = "/plan";

/**
 * 채팅 상태와 이동 — `/chat`이면 최대화, 아니면 store의 최소화 여부로 판단한다.
 * - 열기: `/chat`으로 이동
 * - 최소화·닫기: `/chat`에 있으면 뒤로 가기로 원래 페이지에 돌아가 이동 기록이 쌓이지 않게 한다
 */
export function useChat() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const minimized = useChatPanelStore((s) => s.minimized);
  const onChatRoute = isChatPathname(pathname);
  const chatState: ChatState = onChatRoute ? "maximized" : minimized ? "minimized" : "closed";

  const openChat = useCallback(() => {
    useChatPanelStore.getState().setMinimized(false);
    if (!onChatRoute) router.push(CHAT_PATH);
  }, [onChatRoute, router]);

  const leaveChat = useCallback(
    (nextMinimized: boolean) => {
      useChatPanelStore.getState().setMinimized(nextMinimized);
      if (!onChatRoute) return;
      // 새 탭에서 `/chat`을 바로 열면 기록이 하나뿐이라 back()이 아무 일도 하지 않는다 — 그때는 일정으로 바꾼다
      if (window.history.length > 1) router.back();
      else router.replace(CHAT_FALLBACK_PATH);
    },
    [onChatRoute, router],
  );
  const minimizeChat = useCallback(() => leaveChat(true), [leaveChat]);
  const closeChat = useCallback(() => leaveChat(false), [leaveChat]);

  return { chatState, openChat, minimizeChat, closeChat };
}
