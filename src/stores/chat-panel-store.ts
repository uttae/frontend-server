import { create } from "zustand";

export type ChatState = "closed" | "minimized" | "maximized";

interface ChatPanelStore {
  minimized: boolean;
  setMinimized: (minimized: boolean) => void;
}

export const useChatPanelStore = create<ChatPanelStore>((set) => ({
  minimized: false,
  setMinimized: (minimized) => set({ minimized }),
}));
