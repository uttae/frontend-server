import { create } from "zustand";

export const STOMP_CONNECTION_ISSUE_MESSAGE =
  "실시간 연결을 복구하지 못했어요. 네트워크를 확인한 뒤 다시 시도해 주세요.";

interface StompConnectionStore {
  connectionIssue: string | null;
  setConnectionIssue: (message: string) => void;
  clearConnectionIssue: () => void;
}

export const useStompConnectionStore = create<StompConnectionStore>((set) => ({
  connectionIssue: null,

  setConnectionIssue: (message) => {
    set({ connectionIssue: message });
  },

  clearConnectionIssue: () => {
    set({ connectionIssue: null });
  },
}));
