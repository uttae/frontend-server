import type { PlanPlace } from "@/lib/plan/types";
import { canonicalScheduleTravelMode, type ScheduleTravelModeValue } from "@/lib/plan/scheduleTravelMode";

export type PlanItinerarySegmentDescriptor = {
  scheduleId: number;
  segmentSourceItemId: number;
  destinationItemId: number;
  originPlaceId: string;
  destPlaceId: string;
  travelModeCanon: ScheduleTravelModeValue;
  originLocation?: google.maps.LatLngLiteral;
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
      const o = typeof a.googlePlaceId === "string" ? a.googlePlaceId.trim() : "";
      const d = typeof b.googlePlaceId === "string" ? b.googlePlaceId.trim() : "";
      if (typeof a.itemId !== "number" || typeof b.itemId !== "number" || !o.length || !d.length) {
        continue;
      }
      const travelModeCanon = canonicalScheduleTravelMode(a.travelMode);
      if (!travelModeCanon) continue;
      segments.push({
        scheduleId,
        segmentSourceItemId: a.itemId,
        destinationItemId: b.itemId,
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
