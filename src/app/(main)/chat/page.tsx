"use client";

import { useEffect } from "react";

import { ChatPanel } from "@/components/chat";
import { useMobileView } from "@/contexts/MobileViewContext";
import { useChatPanelStore } from "@/stores/chat-panel-store";

export default function ChatPage() {
  const { isMobileDevice } = useMobileView();

  useEffect(() => {
    useChatPanelStore.getState().setMinimized(false);
  }, []);

  return isMobileDevice ? <ChatPanel mobileInline /> : <ChatPanel inline />;
}
