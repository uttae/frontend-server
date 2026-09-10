import type { ChatState } from "@/stores/chat-panel-store";
import {
  CHAT_PANEL_DOCKED_WIDTH,
  MAIN_SIDEBAR_RAIL_WIDTH,
  width,
} from "@/lib/layout-tokens";

export const MAIN_LAYOUT_WIDTH_TRANSITION = {
  duration: 0.25,
  ease: [0.4, 0, 0.2, 1] as const,
};

/** 플랜: LeftSection 축소 완료 판정 허용 오차(px) */
const PLAN_CHAT_REVEAL_WIDTH_EPSILON_PX = 8;

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
  chatState: ChatState;
  isMobile: boolean;
  rootFontPx?: number;
};

/**
 * LeftSection `maxWidth` 목표(px). `null`이면 flex(`none`).
 * 모바일은 호출측에서 `"100%"` 처리.
 */
export function resolveLeftSectionTargetMaxWidthPx({
  pathname,
  contentWidthToken,
  chatState,
  isMobile,
  rootFontPx = DEFAULT_ROOT_FONT_PX,
}: ResolveLeftSectionTargetMaxWidthParams): number | null {
  if (isMobile) return null;

  if (isPlanPath(pathname)) {
    return chatState === "maximized"
      ? contentTokenToLeftSectionMaxPx(width.s1, rootFontPx)
      : parseLayoutLengthToPx(width.s2, rootFontPx);
  }

  const token = resolveEffectiveContentWidthToken(pathname, contentWidthToken);
  if (!token.length) return null;

  return contentTokenToLeftSectionMaxPx(token, rootFontPx);
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

export function resolveLeftSectionMinWidthPx(isMobile: boolean): number | string {
  return isMobile ? 0 : parseLayoutLengthToPx(CHAT_PANEL_DOCKED_WIDTH);
}

/** 플랜 maximized: LeftSection이 아직 넓으면 채팅 표시를 지연 */
export function shouldDeferChatPanelReveal({
  pathname,
  chatState,
  isMobile,
  targetMaxWidthPx,
  measuredLeftWidthPx,
}: {
  pathname: string;
  chatState: ChatState;
  isMobile: boolean;
  targetMaxWidthPx: number | null;
  measuredLeftWidthPx: number;
}): boolean {
  if (isMobile || chatState !== "maximized") return false;
  if (!isPlanPath(pathname) || targetMaxWidthPx == null) return false;
  if (measuredLeftWidthPx <= 0) return true;
  return measuredLeftWidthPx > targetMaxWidthPx + PLAN_CHAT_REVEAL_WIDTH_EPSILON_PX;
}

/** maximized ChatPanel — `style.width` 전용(Framer width 애니메이션 없음) */
export function resolveChatPanelDockWidthCss({
  pathname,
  chatState,
  isMobile,
  measuredLeftWidthPx,
  targetMaxWidthPx,
}: {
  pathname: string;
  chatState: ChatState;
  isMobile: boolean;
  measuredLeftWidthPx: number;
  targetMaxWidthPx: number | null;
}): string | null {
  if (chatState !== "maximized" || isMobile) return null;

  const planShrinking =
    isPlanPath(pathname) &&
    targetMaxWidthPx != null &&
    measuredLeftWidthPx > targetMaxWidthPx + PLAN_CHAT_REVEAL_WIDTH_EPSILON_PX;

  if (planShrinking && targetMaxWidthPx != null) {
    return toCssPx(targetMaxWidthPx);
  }
  if (measuredLeftWidthPx > 0) return toCssPx(measuredLeftWidthPx);
  if (targetMaxWidthPx != null) return toCssPx(targetMaxWidthPx);
  return toCssPx(parseLayoutLengthToPx(CHAT_PANEL_DOCKED_WIDTH));
}

export const PLAN_CHAT_REVEAL_FALLBACK_MS = Math.round(
  MAIN_LAYOUT_WIDTH_TRANSITION.duration * 1000,
) + 50;
