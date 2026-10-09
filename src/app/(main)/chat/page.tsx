"use client";

import { useEffect } from "react";

import { ChatPanel } from "@/components/chat";
import { useMobileView } from "@/contexts/MobileViewContext";
import { useChatPanelStore } from "@/stores/chat-panel-store";

/** `/chat` — 최대화 채팅 화면. PC는 지도 옆 본문 자리에, 모바일은 전체 화면으로 그린다 */
export default function ChatPage() {
  const { isMobileDevice } = useMobileView();

  // 어떤 경로로 들어오든(사이드바·뒤로가기·주소 입력) 채팅에 들어오면 최소화를 푼다.
  // 그래야 메뉴로 나갈 때 최소화 창이 다시 떠오르지 않는다.
  useEffect(() => {
    useChatPanelStore.getState().setMinimized(false);
  }, []);

  return isMobileDevice ? <ChatPanel mobileInline /> : <ChatPanel inline />;
}
