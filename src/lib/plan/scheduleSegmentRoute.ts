import type { ScheduleItemRouteResponse } from "@/lib/api/rooms";
import { getScheduleItemRoute } from "@/lib/api/rooms";
import { awaitScheduleRoutesBatch } from "@/lib/plan/schedule-bulk-hydration";
import { writeScheduleRouteToSessionStorage } from "@/lib/plan/planTravelLocalStorage";
import type { ScheduleTravelModeValue } from "@/lib/plan/scheduleTravelMode";
import { getQueryClient } from "@/lib/query-client";
import { scheduleItemRouteQueryKey } from "@/lib/query-keys";

export type ScheduleSegmentRoute = ScheduleItemRouteResponse | null;

export type ResolveScheduleSegmentRouteArgs = {
  roomId: string;
  scheduleId: number;
  segmentSourceItemId: number;
  destinationItemId: number;
  travelMode: ScheduleTravelModeValue;
  scheduleFingerprint?: string;
};

export async function resolveScheduleSegmentRoute({
  roomId,
  scheduleId,
  segmentSourceItemId,
  destinationItemId,
  travelMode,
  scheduleFingerprint,
}: ResolveScheduleSegmentRouteArgs): Promise<ScheduleSegmentRoute> {
  const rid = roomId.trim();
  if (!rid.length) return null;

  await awaitScheduleRoutesBatch(rid, scheduleId);

  const routeKey = scheduleItemRouteQueryKey(rid, scheduleId, segmentSourceItemId, destinationItemId, travelMode);
  const cached = getQueryClient()?.getQueryState<ScheduleSegmentRoute>(routeKey);
  if (cached?.data !== undefined && !cached.isInvalidated) {
    return cached.data;
  }

  const fresh = await getScheduleItemRoute(rid, scheduleId, segmentSourceItemId, destinationItemId, travelMode);

  const fp = scheduleFingerprint?.trim() ?? "";
  if (fp.length > 0) {
    writeScheduleRouteToSessionStorage(rid, scheduleId, segmentSourceItemId, destinationItemId, travelMode, fp, fresh);
  }

  return fresh;
}
