"use client";

import { usePathname } from "next/navigation";
import { useMobileView } from "@/contexts/MobileViewContext";
import { isChatPathname } from "@/lib/mobile-view";
import { useChatPanelStore } from "@/stores/chat-panel-store";

/** 실제로 채팅이 화면에 보이는지 — 읽음 처리·안 읽은 수 조회에 쓴다 */
export function useChatPanelOpen() {
  const { isMobileDevice } = useMobileView();
  const pathname = usePathname();
  const minimized = useChatPanelStore((s) => s.minimized);
  // `/chat`(최대화)이거나, PC에서 다른 페이지 위에 최소화 채팅이 떠 있으면 채팅을 보고 있는 것으로 본다
  return isChatPathname(pathname) || (!isMobileDevice && minimized);
}
