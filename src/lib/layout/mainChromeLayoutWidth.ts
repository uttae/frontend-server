import { isPackingPath } from "@/lib/room-context-path";
import {
  CHAT_PANEL_DOCKED_WIDTH,
  MAIN_MAP_MIN_WIDTH_PX,
  MAIN_SIDEBAR_RAIL_WIDTH,
  width,
} from "@/lib/layout-tokens";

export const MAIN_LAYOUT_WIDTH_TRANSITION = {
  duration: 0.25,
  ease: [0.4, 0, 0.2, 1] as const,
};

const DEFAULT_ROOT_FONT_PX = 16;

export function isPlanPath(pathname: string): boolean {
  return pathname === "/plan" || pathname.startsWith("/plan/");
}

export function toCssPx(px: number): string {
  return `${Math.max(0, Math.round(px))}px`;
}

/** `400px` / `3.25rem` 등 레이아웃 토큰을 px로 변환 */
export function parseLayoutLengthToPx(
  value: string,
  rootFontPx = DEFAULT_ROOT_FONT_PX,
): number {
  const trimmed = value.trim();
  if (!trimmed.length) return 0;
  if (trimmed.endsWith("px")) {
    return Number.parseFloat(trimmed) || 0;
  }
  if (trimmed.endsWith("rem")) {
    return (Number.parseFloat(trimmed) || 0) * rootFontPx;
  }
  const n = Number.parseFloat(trimmed);
  return Number.isFinite(n) ? n : 0;
}

/** 본문 토큰 + 사이드바 레일 → LeftSection maxWidth(px) */
export function contentTokenToLeftSectionMaxPx(
  contentWidth: string,
  rootFontPx = DEFAULT_ROOT_FONT_PX,
): number {
  return Math.round(
    parseLayoutLengthToPx(contentWidth, rootFontPx) +
      parseLayoutLengthToPx(MAIN_SIDEBAR_RAIL_WIDTH, rootFontPx),
  );
}

/** `SetSectionMaxWidth` effect 전에도 라우트별 s1 폭을 동기 적용 */
export function resolveRouteDefaultContentWidth(pathname: string): string {
  if (isPlanPath(pathname)) return "";
  if (
    pathname === "/search" ||
    pathname.startsWith("/search/") ||
    pathname === "/bookmark" ||
    pathname.startsWith("/bookmark/") ||
    pathname === "/member-settings" ||
    pathname.startsWith("/member-settings/") ||
    pathname === "/room-settings" ||
    pathname.startsWith("/room-settings/")
  ) {
    return width.s1;
  }
  return "";
}

export function resolveEffectiveContentWidthToken(
  pathname: string,
  contextToken: string,
): string {
  const trimmed = contextToken.trim();
  if (trimmed.length > 0) return trimmed;
  return resolveRouteDefaultContentWidth(pathname);
}

export type ResolveLeftSectionTargetMaxWidthParams = {
  pathname: string;
  contentWidthToken: string;
  isMobile: boolean;
  rootFontPx?: number;
};

/**
 * 가계부·준비물은 지도 없이 전체 폭, 나머지 협업 공간(`/chat` 포함)은 일정 기준 폭(사이드바 포함)을 사용.
 * 모바일은 호출측에서 `"100%"` 처리.
 */
export function resolveLeftSectionTargetMaxWidthPx({
  pathname,
  isMobile,
  rootFontPx = DEFAULT_ROOT_FONT_PX,
}: ResolveLeftSectionTargetMaxWidthParams): number | null {
  if (isMobile || pathname === "/cost" || isPackingPath(pathname)) return null;

  return parseLayoutLengthToPx(width.s2, rootFontPx);
}

export function resolveLeftSectionAnimateMaxWidth({
  targetMaxWidthPx,
  isMobile,
}: {
  targetMaxWidthPx: number | null;
  isMobile: boolean;
}): string {
  if (isMobile) return "100%";
  if (targetMaxWidthPx != null) return toCssPx(targetMaxWidthPx);
  return "none";
}

/** 데스크톱 `LeftSection` 오른쪽 테두리 — 최소 폭(border-box)에 더해야 패널이 400을 다 쓴다 */
const LEFT_SECTION_BORDER_PX = 1;

/**
 * 데스크톱 좌측 영역 최소 폭.
 * - 일정·채팅 등: 패널 400 + 사이드바 레일 + 테두리(469). 옆 지도 최소 380과 합쳐 레이아웃 최소 849.
 * - 지도 없이 전체 폭을 쓰는 가계부·준비물: 좌측 영역이 레이아웃 최소 849를 다 맡는다.
 * - 패널 오른쪽에 상세가 붙으면(준비물 상세 440) 패널 400을 지킨 채 상세 폭을 더한다.
 * 화면이 이보다 좁으면 레이아웃 안에서 가로 스크롤한다.
 */
export function resolveDesktopLeftSectionMinWidthPx(pathname = "", sideDetailWidthPx = 0): number {
  const panelMinPx =
    parseLayoutLengthToPx(CHAT_PANEL_DOCKED_WIDTH) +
    parseLayoutLengthToPx(MAIN_SIDEBAR_RAIL_WIDTH) +
    LEFT_SECTION_BORDER_PX;
  const withDetailPx = panelMinPx + Math.max(0, sideDetailWidthPx);
  if (pathname === "/cost" || isPackingPath(pathname)) {
    return Math.max(panelMinPx + MAIN_MAP_MIN_WIDTH_PX, withDetailPx);
  }
  return withDetailPx;
}
