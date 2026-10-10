import { create } from "zustand";

/**
 * 웹 일정에서 고른 장소 — 카드 강조, 지도 이동, 번호 핀 키우기, 그 일차 경로만 보기에 쓴다.
 * 장소 상세(선택 장소)와는 따로다: 일정 카드로 고르면 상세를 열지 않고(조회도 없음), 지도 핀으로 고르면 상세와 함께 고른다.
 */
export type PlanMapFocus = {
  roomId: string;
  scheduleId: number;
  itemId: number;
  /** 지도에서 같은 장소의 일반 선택 핀 대신 번호 핀을 보이려고 쓴다 */
  googlePlaceId: string | null;
  location: { lat: number; lng: number } | null;
  /** 어디서 골랐는지 — 지도 핀으로 고르면 일정 목록을 그 카드로 스크롤한다 */
  source: "card" | "map";
  /** 같은 장소를 다시 골라도 지도를 다시 옮기도록 고를 때마다 바뀐다 */
  seq: number;
};

type PlanMapFocusState = {
  focus: PlanMapFocus | null;
  focusPlace: (target: Omit<PlanMapFocus, "seq">) => void;
  clearFocus: () => void;
};

export const usePlanMapFocusStore = create<PlanMapFocusState>((set, get) => ({
  focus: null,
  focusPlace: (target) => set({ focus: { ...target, seq: (get().focus?.seq ?? 0) + 1 } }),
  clearFocus: () => set({ focus: null }),
}));
