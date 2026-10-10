"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { isChatPathname, CHAT_PATH } from "@/lib/mobile-view";
import type { ChatState } from "@/stores/chat-panel-store";
import { useChatPanelStore } from "@/stores/chat-panel-store";

export type { ChatState };

/** 돌아갈 기록이 없을 때(새 탭에서 `/chat`을 바로 연 경우) 갈 곳 */
const CHAT_FALLBACK_PATH = "/plan";
const CHAT_RETURN_HISTORY_KEY = "uttaeChatReturn";
// openChat의 push가 완료됐을 때만 현재 history entry에 복귀 가능 표시를 남긴다.
// 훅은 사이드바·패널 등에서 함께 쓰므로 이동 요청은 모듈에서 공유한다.
let pendingChatOrigin: string | null = null;

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
  let chatState: ChatState = minimized ? "minimized" : "closed";
  if (onChatRoute) chatState = "maximized";

  useEffect(() => {
    if (pendingChatOrigin === null) return;
    if (onChatRoute) {
      window.history.replaceState(
        { ...window.history.state, [CHAT_RETURN_HISTORY_KEY]: true },
        "",
      );
      pendingChatOrigin = null;
    } else if (pathname !== pendingChatOrigin) {
      // 채팅 대신 다른 페이지로 이동했다면 이전 요청을 재사용하지 않는다.
      pendingChatOrigin = null;
    }
  }, [onChatRoute, pathname]);

  const openChat = useCallback(() => {
    useChatPanelStore.getState().setMinimized(false);
    if (!onChatRoute) {
      pendingChatOrigin = pathname;
      router.push(CHAT_PATH);
    }
  }, [onChatRoute, pathname, router]);

  const leaveChat = useCallback(
    (nextMinimized: boolean) => {
      useChatPanelStore.getState().setMinimized(nextMinimized);
      if (!onChatRoute) return;
      // 기록 길이에는 외부 사이트·앞으로 갈 기록도 포함된다. 앱에서 연 entry만 뒤로 간다.
      if (window.history.state?.[CHAT_RETURN_HISTORY_KEY] === true) router.back();
      else router.replace(CHAT_FALLBACK_PATH);
    },
    [onChatRoute, router],
  );
  const minimizeChat = useCallback(() => leaveChat(true), [leaveChat]);
  const closeChat = useCallback(() => leaveChat(false), [leaveChat]);

  return { chatState, openChat, minimizeChat, closeChat };
}
