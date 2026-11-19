import type { ScheduleItemRouteResponse } from "@/lib/api/rooms";

import { canonicalScheduleTravelMode, type ScheduleTravelModeValue } from "@/lib/plan/scheduleTravelMode";

export type ScheduleItemRouteSummary = Pick<ScheduleItemRouteResponse, "distanceMeters" | "durationSeconds">;

export function buildScheduleItemRouteSummariesByMode(
  route: ScheduleItemRouteResponse | null | undefined,
): Partial<Record<ScheduleTravelModeValue, ScheduleItemRouteSummary>> {
  if (!route || typeof route !== "object") return {};

  const out: Partial<Record<ScheduleTravelModeValue, ScheduleItemRouteSummary>> = {};

  const consider = (partial: Pick<ScheduleItemRouteResponse, keyof ScheduleItemRouteResponse>): void => {
    const tm = typeof partial.travelMode === "string" ? partial.travelMode.trim() : "";
    const canon = tm.length ? canonicalScheduleTravelMode(tm) : null;
    if (canon == null || typeof partial.distanceMeters !== "number" || typeof partial.durationSeconds !== "number") {
      return;
    }
    if (partial.distanceMeters < 0 || partial.durationSeconds < 0) return;
    out[canon] = {
      distanceMeters: partial.distanceMeters,
      durationSeconds: partial.durationSeconds,
    };
  };

  consider(route);
  const fromArrays = [...(route.routes ?? []), ...(route.modeRoutes ?? [])];
  for (const piece of fromArrays) {
    if (!piece || typeof piece !== "object") continue;
    consider(piece as ScheduleItemRouteResponse);
  }

  return out;
}
