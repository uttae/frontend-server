import { isPackingPath } from "@/lib/room-context-path";
import {
  CHAT_PANEL_DOCKED_WIDTH,
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

export function resolveDesktopLeftSectionMinWidthPx(pathname = ""): number {
  return isPackingPath(pathname) ? 0 : parseLayoutLengthToPx(CHAT_PANEL_DOCKED_WIDTH);
}
