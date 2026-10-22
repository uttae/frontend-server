"use client";

import { usePathname } from "next/navigation";

import { useMobileView } from "@/contexts/MobileViewContext";
import { isPlanPath } from "@/lib/layout/mainChromeLayoutWidth";
import { usePlanMapFocusStore } from "@/stores/plan-map-focus-store";
import { useSessionStore } from "@/stores/session-store";

/**
 * 웹 동선보기 — PC 일정 화면에서 이 방의 장소를 골라 그 일차 경로를 보는 중(장소 이동 스테퍼가 뜨는 상태).
 * 지도 상단 검색창·카테고리·필터와 재검색 버튼을 숨긴다(Figma 6115:807). 모바일은 경로 보기(`routeView`)가 따로 숨긴다.
 * 번호 핀은 다른 탭에서도 눌러 고를 수 있어 일정 화면일 때만 본다.
 */
export function useWebPlanRouteMode(): boolean {
  const pathname = usePathname();
  const { isMobileDevice } = useMobileView();
  const roomId = useSessionStore((s) => s.currentRoomId?.trim() ?? "");
  const focused = usePlanMapFocusStore((s) => roomId.length > 0 && s.focus?.roomId === roomId);
  return focused && !isMobileDevice && isPlanPath(pathname ?? "");
}
