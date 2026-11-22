import type { OmitKeyof, QueryClient, QueryKey, UseQueryOptions } from "@tanstack/react-query";

import type { ScheduleItemRouteResponse } from "@/lib/api/rooms";
import { resolveScheduleSegmentRoute } from "@/lib/plan/scheduleSegmentRoute";
import { scheduleItemRouteQueryKey } from "@/lib/query-keys";
import { readScheduleRouteFromSessionStorage } from "@/lib/plan/planTravelLocalStorage";
import type { ScheduleTravelModeValue } from "@/lib/plan/scheduleTravelMode";

type RouteCached = ScheduleItemRouteResponse | null;

export type PersistedScheduleRoutePersistFlags = {
  segmentReady: boolean;
  networkEnabled?: boolean;
};

export function persistedScheduleItemRouteQueryOptions(
  roomIdTrimmed: string,
  scheduleId: number | null,
  segmentSourceItemId: number | null,
  destinationItemId: number | null,
  travelMode: ScheduleTravelModeValue | null,
  fingerprintTrimmed: string,
  flags: PersistedScheduleRoutePersistFlags,
): OmitKeyof<UseQueryOptions<RouteCached, Error, RouteCached, QueryKey>, "queryKey"> & {
  queryKey: ReturnType<typeof scheduleItemRouteQueryKey>;
} {
  const rid = roomIdTrimmed.trim();
  const sid = scheduleId;
  const sidOk = typeof sid === "number" && Number.isFinite(sid);
  const itemOk = typeof segmentSourceItemId === "number" && Number.isFinite(segmentSourceItemId);
  const destOk = typeof destinationItemId === "number" && Number.isFinite(destinationItemId);
  const fp = fingerprintTrimmed.trim();

  const keyEligible = flags.segmentReady && travelMode !== null && rid.length > 0 && sidOk && itemOk && destOk;

  const network = typeof flags.networkEnabled === "boolean" ? flags.networkEnabled : flags.segmentReady;

  const enabled = keyEligible && network;

  const keyRoom = rid.length > 0 ? rid : null;
  const keySchedule = sidOk ? sid : null;
  const keySegment = itemOk ? segmentSourceItemId : null;
  const keyDestination = destOk ? destinationItemId : null;
  const keyMode = sidOk && itemOk && destOk && rid.length > 0 ? travelMode : null;

  const sessionSeed: RouteCached | undefined =
    fp.length > 0 && typeof window !== "undefined" && keyEligible && rid.length > 0
      ? readScheduleRouteFromSessionStorage(rid, sid!, segmentSourceItemId!, destinationItemId!, travelMode, fp)
      : undefined;

  return {
    queryKey: scheduleItemRouteQueryKey(keyRoom, keySchedule, keySegment, keyDestination, keyMode),
    ...(sessionSeed !== undefined
      ? {
          initialData: sessionSeed,
          initialDataUpdatedAt: typeof window !== "undefined" ? Date.now() : 0,
        }
      : {}),
    queryFn: (): Promise<RouteCached> =>
      travelMode === null
        ? Promise.resolve(null)
        : resolveScheduleSegmentRoute({
            roomId: rid,
            scheduleId: sid!,
            segmentSourceItemId: segmentSourceItemId!,
            destinationItemId: destinationItemId!,
            travelMode,
            scheduleFingerprint: fp,
          }),
    enabled,
    staleTime: 1000 * 60 * 60 * 6,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
  };
}

export async function loadScheduleItemRouteForMap(
  queryClient: QueryClient,
  options: ReturnType<typeof persistedScheduleItemRouteQueryOptions>,
): Promise<RouteCached> {
  const state = queryClient.getQueryState<RouteCached>(options.queryKey);
  if (state?.status === "error" && state.fetchStatus === "idle") {
    return state.data ?? null;
  }
  return queryClient.fetchQuery(options);
}
