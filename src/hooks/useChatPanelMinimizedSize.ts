"use client";

import { useCallback, useState } from "react";

import { useClientReady } from "./useClientReady";

import {
  CHAT_PANEL_MINIMIZED_DEFAULT,
  clampChatPanelMinimizedSize,
  readChatPanelMinimizedSize,
  writeChatPanelMinimizedSize,
  type ChatPanelMinimizedSize,
} from "@/lib/chat/chat-panel-minimized-size";

export function useChatPanelMinimizedSize() {
  const ready = useClientReady();
  const [draftSize, setSizeState] = useState<ChatPanelMinimizedSize | null>(null);
  const size = draftSize ?? (ready ? readChatPanelMinimizedSize() : CHAT_PANEL_MINIMIZED_DEFAULT);

  const clampSize = useCallback((width: number, height: number) => {
    if (typeof window === "undefined") {
      return clampChatPanelMinimizedSize(width, height);
    }
    return clampChatPanelMinimizedSize(width, height, window);
  }, []);

  const setSize = useCallback(
    (next: ChatPanelMinimizedSize) => {
      setSizeState(clampSize(next.width, next.height));
    },
    [clampSize],
  );

  const persistSize = useCallback((next: ChatPanelMinimizedSize) => {
    const clamped = clampSize(next.width, next.height);
    setSizeState(clamped);
    writeChatPanelMinimizedSize(clamped);
  }, [clampSize]);

  return { size, setSize, persistSize, clampSize };
}
