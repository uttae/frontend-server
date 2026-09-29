import { create } from "zustand";

/** 모바일 일정 상단 탭 — 전체 또는 특정 일차(scheduleId) */
export type MobilePlanDayFilter = "all" | number;

type MobilePlanDayFilterState = {
  /** 방별로 마지막에 고른 탭 — 화면을 오가도 유지한다(새로고침하면 초기화) */
  filterByRoomId: Record<string, MobilePlanDayFilter>;
  setFilter: (roomId: string, filter: MobilePlanDayFilter) => void;
};

export const useMobilePlanDayFilterStore = create<MobilePlanDayFilterState>((set) => ({
  filterByRoomId: {},
  setFilter: (roomId, filter) =>
    set((s) => ({ filterByRoomId: { ...s.filterByRoomId, [roomId]: filter } })),
}));
