import { create } from "zustand";

/**
 * 채팅 패널 UI 크롬 (열림·최소화·닫힘).
 * 최대화는 `/chat` 경로가 결정하므로 store에는 최소화 여부만 둔다.
 */
export type ChatState = "closed" | "minimized" | "maximized";

interface ChatPanelStore {
  minimized: boolean;
  setMinimized: (minimized: boolean) => void;
}

export const useChatPanelStore = create<ChatPanelStore>((set) => ({
  minimized: false,
  setMinimized: (minimized) => set({ minimized }),
}));
