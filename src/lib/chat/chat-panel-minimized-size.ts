const STORAGE_KEY = "hau:chat-panel-minimized-size:v1";

export const CHAT_PANEL_MINIMIZED_MIN_WIDTH = 288;
export const CHAT_PANEL_MINIMIZED_MIN_HEIGHT = 460;

export const CHAT_PANEL_MINIMIZED_MAX_WIDTH = 400;
export const CHAT_PANEL_MINIMIZED_MAX_HEIGHT = 620;

export const CHAT_PANEL_MINIMIZED_VIEWPORT_INSET_PX = 16;
export const CHAT_PANEL_MINIMIZED_VIEWPORT_INSET_RIGHT_PX = 10;

export type ChatPanelMinimizedSize = {
  width: number;
  height: number;
};

export const CHAT_PANEL_MINIMIZED_DEFAULT: ChatPanelMinimizedSize = {
  width: 344,
  height: 564,
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
        viewport.innerWidth - inset - CHAT_PANEL_MINIMIZED_VIEWPORT_INSET_RIGHT_PX,
      )
    : CHAT_PANEL_MINIMIZED_MAX_WIDTH;
  const maxHeightFromViewport = viewport
    ? Math.max(CHAT_PANEL_MINIMIZED_MIN_HEIGHT, viewport.innerHeight - inset * 2)
    : CHAT_PANEL_MINIMIZED_MAX_HEIGHT;

  const maxWidth = Math.min(CHAT_PANEL_MINIMIZED_MAX_WIDTH, maxWidthFromViewport);
  const maxHeight = Math.min(CHAT_PANEL_MINIMIZED_MAX_HEIGHT, maxHeightFromViewport);

  return {
    width: Math.min(maxWidth, Math.max(CHAT_PANEL_MINIMIZED_MIN_WIDTH, Math.round(width))),
    height: Math.min(maxHeight, Math.max(CHAT_PANEL_MINIMIZED_MIN_HEIGHT, Math.round(height))),
  };
}

export function readChatPanelMinimizedSize(): ChatPanelMinimizedSize {
  if (typeof window === "undefined") {
    return CHAT_PANEL_MINIMIZED_DEFAULT;
  }

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw)
      return clampChatPanelMinimizedSize(
        CHAT_PANEL_MINIMIZED_DEFAULT.width,
        CHAT_PANEL_MINIMIZED_DEFAULT.height,
        window,
      );
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
    const clamped = clampChatPanelMinimizedSize(size.width, size.height, window);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(clamped));
  } catch {}
}
