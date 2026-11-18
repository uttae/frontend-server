const STORAGE_KEY = "hau:chat-panel-minimized-size:v1";

/** 최소화 창 기본·최소 폭 — Figma Chat/Minimize(6663:4929) 344 */
export const CHAT_PANEL_MINIMIZED_MIN_WIDTH = 344;
/** 최소화 창 기본·최소 높이 — Figma 564(제목 줄 64 + 대화 400 + 입력 100) */
export const CHAT_PANEL_MINIMIZED_MIN_HEIGHT = 564;

/** [`CHAT_PANEL_DOCKED_WIDTH`](src/lib/layout-tokens.ts)와 정렬 */
export const CHAT_PANEL_MINIMIZED_MAX_WIDTH = 400;
export const CHAT_PANEL_MINIMIZED_MAX_HEIGHT = 620;

/** minimized 패널 — 뷰포트 하단·좌측(clamp) 여백(px) */
export const CHAT_PANEL_MINIMIZED_VIEWPORT_INSET_PX = 16;
/** minimized 패널 — 뷰포트 우측 앵커 여백(px) */
export const CHAT_PANEL_MINIMIZED_VIEWPORT_INSET_RIGHT_PX = 10;

export type ChatPanelMinimizedSize = {
  width: number;
  height: number;
};

export const CHAT_PANEL_MINIMIZED_DEFAULT: ChatPanelMinimizedSize = {
  width: CHAT_PANEL_MINIMIZED_MIN_WIDTH,
  height: CHAT_PANEL_MINIMIZED_MIN_HEIGHT,
};

function isValidSize(value: unknown): value is ChatPanelMinimizedSize {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return typeof o.width === "number" && typeof o.height === "number";
}

export function clampChatPanelMinimizedSize(
  width: number,
  height: number,
  viewport?: { innerWidth: number; innerHeight: number },
): ChatPanelMinimizedSize {
  const inset = CHAT_PANEL_MINIMIZED_VIEWPORT_INSET_PX;
  const maxWidthFromViewport = viewport
    ? Math.max(
        CHAT_PANEL_MINIMIZED_MIN_WIDTH,
        viewport.innerWidth -
          inset -
          CHAT_PANEL_MINIMIZED_VIEWPORT_INSET_RIGHT_PX,
      )
    : CHAT_PANEL_MINIMIZED_MAX_WIDTH;
  const maxHeightFromViewport = viewport
    ? Math.max(
        CHAT_PANEL_MINIMIZED_MIN_HEIGHT,
        viewport.innerHeight - inset * 2,
      )
    : CHAT_PANEL_MINIMIZED_MAX_HEIGHT;

  const maxWidth = Math.min(
    CHAT_PANEL_MINIMIZED_MAX_WIDTH,
    maxWidthFromViewport,
  );
  const maxHeight = Math.min(
    CHAT_PANEL_MINIMIZED_MAX_HEIGHT,
    maxHeightFromViewport,
  );

  return {
    width: Math.min(
      maxWidth,
      Math.max(CHAT_PANEL_MINIMIZED_MIN_WIDTH, Math.round(width)),
    ),
    height: Math.min(
      maxHeight,
      Math.max(CHAT_PANEL_MINIMIZED_MIN_HEIGHT, Math.round(height)),
    ),
  };
}

export function readChatPanelMinimizedSize(): ChatPanelMinimizedSize {
  if (typeof window === "undefined") {
    return CHAT_PANEL_MINIMIZED_DEFAULT;
  }

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return CHAT_PANEL_MINIMIZED_DEFAULT;
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidSize(parsed)) return CHAT_PANEL_MINIMIZED_DEFAULT;
    return clampChatPanelMinimizedSize(parsed.width, parsed.height, window);
  } catch {
    return CHAT_PANEL_MINIMIZED_DEFAULT;
  }
}

export function writeChatPanelMinimizedSize(size: ChatPanelMinimizedSize): void {
  if (typeof window === "undefined") return;

  try {
    const clamped = clampChatPanelMinimizedSize(
      size.width,
      size.height,
      window,
    );
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(clamped));
  } catch {
    /* quota / private mode */
  }
}
