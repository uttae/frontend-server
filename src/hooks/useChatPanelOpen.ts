"use client";

import { usePathname } from "next/navigation";
import { useMobileView } from "@/contexts/MobileViewContext";
import { isChatPathname } from "@/lib/mobile-view";
import { useChatPanelStore } from "@/stores/chat-panel-store";

export function useChatPanelOpen() {
  const { isMobileDevice } = useMobileView();
  const pathname = usePathname();
  const minimized = useChatPanelStore((s) => s.minimized);
  return isChatPathname(pathname) || (!isMobileDevice && minimized);
}
