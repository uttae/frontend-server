import { create } from "zustand";

export type MobilePlanDayFilter = "all" | number;

type MobilePlanDayFilterState = {
  filterByRoomId: Record<string, MobilePlanDayFilter>;
  setFilter: (roomId: string, filter: MobilePlanDayFilter) => void;
};

export const useMobilePlanDayFilterStore = create<MobilePlanDayFilterState>((set) => ({
  filterByRoomId: {},
  setFilter: (roomId, filter) =>
    set((s) => ({ filterByRoomId: { ...s.filterByRoomId, [roomId]: filter } })),
}));
