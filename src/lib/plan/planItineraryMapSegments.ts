/// <reference types="google.maps" />

import type { PlanPlace } from "@/lib/plan/types";
import {
  canonicalScheduleTravelMode,
  type ScheduleTravelModeValue,
} from "@/lib/plan/scheduleTravelMode";

/** 펼친 일차 일정 순서에서 인접 두 장소로 만든 Directions 구간 단위 */
export type PlanItinerarySegmentDescriptor = {
  scheduleId: number;
  segmentSourceItemId: number;
  originPlaceId: string;
  destPlaceId: string;
  travelModeCanon: ScheduleTravelModeValue;
  /** 순서상 앞(작은 번호) 장소 — 경로 방향 보정 */
  originLocation?: google.maps.LatLngLiteral;
  /** 순서상 뒤(큰 번호) 장소 — 경로 방향 보정 */
  destLocation?: google.maps.LatLngLiteral;
};

export function flattenPlanItinerarySegmentsFromPlaces(
  expandedScheduleIds: number[],
  placesBuckets: PlanPlace[][],
): PlanItinerarySegmentDescriptor[] {
  const segments: PlanItinerarySegmentDescriptor[] = [];

  expandedScheduleIds.forEach((scheduleId, idx) => {
    const places = placesBuckets[idx];
    if (!places?.length) return;
    for (let i = 0; i < places.length - 1; i += 1) {
      const a = places[i]!;
      const b = places[i + 1]!;
      const o =
        typeof a.googlePlaceId === "string" ? a.googlePlaceId.trim() : "";
      const d =
        typeof b.googlePlaceId === "string" ? b.googlePlaceId.trim() : "";
      if (typeof a.itemId !== "number" || !o.length || !d.length) {
        continue;
      }
      const travelModeCanon = canonicalScheduleTravelMode(a.travelMode);
      if (!travelModeCanon) continue;
      segments.push({
        scheduleId,
        segmentSourceItemId: a.itemId,
        originPlaceId: o,
        destPlaceId: d,
        travelModeCanon,
        originLocation: a.location,
        destLocation: b.location,
      });
    }
  });

  return segments;
}
