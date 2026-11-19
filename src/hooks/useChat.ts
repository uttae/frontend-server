"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { isChatPathname, CHAT_PATH } from "@/lib/mobile-view";
import type { ChatState } from "@/stores/chat-panel-store";
import { useChatPanelStore } from "@/stores/chat-panel-store";

export type { ChatState };

const CHAT_FALLBACK_PATH = "/plan";
const CHAT_RETURN_HISTORY_KEY = "uttaeChatReturn";
let pendingChatOrigin: string | null = null;

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
      if (window.history.state?.[CHAT_RETURN_HISTORY_KEY] === true) router.back();
      else router.replace(CHAT_FALLBACK_PATH);
    },
    [onChatRoute, router],
  );
  const minimizeChat = useCallback(() => leaveChat(true), [leaveChat]);
  const closeChat = useCallback(() => leaveChat(false), [leaveChat]);

  return { chatState, openChat, minimizeChat, closeChat };
}
