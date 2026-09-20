import { create } from "zustand";
import { parseRoomContextPath } from "@/lib/room-context-path";

import {
  clearCurrentRoomIdSessionStorage,
  readCurrentRoomIdFromSessionStorage,
  writeCurrentRoomIdToSessionStorage,
} from "@/lib/session-room-storage";

interface SessionStore {
  /** `reconcileClientSession` 완료 후 true */
  sessionReady: boolean;
  setSessionReady: (ready: boolean) => void;
  /** 현재 방 ID — 메모리 + sessionStorage(탭 수명) */
  currentRoomId: string | null;
  setCurrentRoomId: (id: string) => void;
  clearCurrentRoomId: () => void;
  /** 로그아웃·강퇴·세션 무효 시 방 포인터·bootstrap 플래그 정리 */
  clearSessionRoomContext: () => void;
}

export const useSessionStore = create<SessionStore>()((set) => ({
  sessionReady: false,
  setSessionReady: (ready) => set({ sessionReady: ready }),
  currentRoomId: null,
  setCurrentRoomId: (id) => {
    const trimmed = typeof id === "string" ? id.trim() : "";
    if (trimmed.length > 0) {
      writeCurrentRoomIdToSessionStorage(trimmed);
      set({ currentRoomId: trimmed });
    } else {
      clearCurrentRoomIdSessionStorage();
      set({ currentRoomId: null });
    }
  },
  clearCurrentRoomId: () => {
    clearCurrentRoomIdSessionStorage();
    set({ currentRoomId: null });
  },
  clearSessionRoomContext: () => {
    clearCurrentRoomIdSessionStorage();
    set({
      sessionReady: false,
      currentRoomId: null,
    });
  },
}));

/** sessionStorage 방 ID를 Zustand에 동기 시드 */
export function bootstrapCurrentRoomFromSessionStorage(pathname?: string): void {
  if (typeof window === "undefined") return;
  const route = parseRoomContextPath(pathname ?? window.location.pathname);
  if (route.invalidPackingPath) return;
  const roomId = route.roomId ?? readCurrentRoomIdFromSessionStorage();
  if (!roomId) return;

  const { currentRoomId, setCurrentRoomId } = useSessionStore.getState();
  if (currentRoomId?.trim() !== roomId) {
    setCurrentRoomId(roomId);
  }
}
