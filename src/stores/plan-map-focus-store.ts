import { create } from "zustand";

import type { PlanPlace } from "@/lib/plan/types";

export type PlanMapFocus = {
  roomId: string;
  scheduleId: number;
  itemId: number;
  googlePlaceId: string | null;
  location: { lat: number; lng: number } | null;
  source: "card" | "map" | "stepper";
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

export const PLAN_MAP_FOCUS_NO_LOCATION_MESSAGE = "지도에 표시할 위치 정보가 없어요.";

export function planPlaceFocusTarget(
  place: PlanPlace,
  roomId: string,
  scheduleId: number,
  source: PlanMapFocus["source"],
): Omit<PlanMapFocus, "seq"> | null {
  if (typeof place.itemId !== "number") return null;
  const loc = place.location;
  const hasLocation = loc != null && Number.isFinite(loc.lat) && Number.isFinite(loc.lng);
  return {
    roomId,
    scheduleId,
    itemId: place.itemId,
    googlePlaceId: place.googlePlaceId?.trim() || null,
    location: hasLocation ? { lat: loc.lat, lng: loc.lng } : null,
    source,
  };
}
