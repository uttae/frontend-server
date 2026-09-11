"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useMobileView } from "@/contexts/MobileViewContext";
import { readMobilePlanPanel } from "@/lib/mobile-view";
import { useChatPanelStore } from "@/stores/chat-panel-store";

/** 모바일은 URL, 데스크톱은 패널 상태로 실제 채팅 표시 여부를 판단한다. */
export function useChatPanelOpen() {
  const { isMobileDevice } = useMobileView();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const desktopOpen = useChatPanelStore((s) => s.chatState !== "closed");
  if (!isMobileDevice) return desktopOpen;
  const isPlan = pathname === "/plan" || pathname.startsWith("/plan/");
  return isPlan && readMobilePlanPanel(searchParams.get("view")) === "chat";
}
