"use client";

import { usePathname } from "next/navigation";

import { useMobileView } from "@/contexts/MobileViewContext";
import { isPlanPath } from "@/lib/layout/mainChromeLayoutWidth";
import { usePlanMapFocusStore } from "@/stores/plan-map-focus-store";
import { useSessionStore } from "@/stores/session-store";

export function useWebPlanRouteMode(): boolean {
  const pathname = usePathname();
  const { isMobileDevice } = useMobileView();
  const roomId = useSessionStore((s) => s.currentRoomId?.trim() ?? "");
  const focused = usePlanMapFocusStore((s) => roomId.length > 0 && s.focus?.roomId === roomId);
  return focused && !isMobileDevice && isPlanPath(pathname ?? "");
}
