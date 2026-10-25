import { create } from "zustand";

export const STOMP_CONNECTION_ISSUE_MESSAGE =
  "실시간 연결을 복구하지 못했어요. 네트워크를 확인한 뒤 다시 시도해 주세요.";

/** 끊긴 상태가 이만큼 이어지면 배너를 띄운다. 기존 체감(세션 확인 5초 간격 10회 실패 뒤 배너)에 맞춘다 */
export const STOMP_CONNECTION_ISSUE_DELAY_MS = 45_000;

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
