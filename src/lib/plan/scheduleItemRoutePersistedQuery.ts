import type {
  OmitKeyof,
  QueryClient,
  QueryKey,
  UseQueryOptions,
} from "@tanstack/react-query";

import type { ScheduleItemRouteResponse } from "@/lib/api/rooms";
import { resolveScheduleSegmentRoute } from "@/lib/plan/scheduleSegmentRoute";
import { scheduleItemRouteQueryKey } from "@/lib/query-keys";
import { readScheduleRouteFromSessionStorage } from "@/lib/plan/planTravelLocalStorage";
import type { ScheduleTravelModeValue } from "@/lib/plan/scheduleTravelMode";

type RouteCached = ScheduleItemRouteResponse | null;

/**
 * — `segmentReady`: 네트워크 패치·sessionStorage 시드 허용(`routeQueryEnabled`). 쿼리 키는 이것과 무관하게
 *   `(room, schedule, 구간, 모드)`로 고정 — 일정 refetch 중 잠깐 false가 되어도 구간끼리 캐시를 공유하지 않음
 * — `networkEnabled` 생략 시 `segmentReady`와 동일; 지연 수단은 메뉴 열림 시만 `true`
 */
export type PersistedScheduleRoutePersistFlags = {
  /** 일정·구간 준비 전에는 패치·sessionStorage 시드 차단 — `routeQueryEnabled` */
  segmentReady: boolean;
  /** 널이면 `segmentReady`와 동일 — 지연 수단만 false로 메뉴 닫힘 시 패치 차단 */
  networkEnabled?: boolean;
};

/** `GET …/route?travelMode=…` — sessionStorage(`scheduleFingerprint` 일치) ↔ React Query */
export function persistedScheduleItemRouteQueryOptions(
  roomIdTrimmed: string,
  scheduleId: number | null,
  segmentSourceItemId: number | null,
  travelMode: ScheduleTravelModeValue,
  fingerprintTrimmed: string,
  flags: PersistedScheduleRoutePersistFlags,
): OmitKeyof<
  UseQueryOptions<RouteCached, Error, RouteCached, QueryKey>,
  "queryKey"
> & { queryKey: ReturnType<typeof scheduleItemRouteQueryKey> } {
  const rid = roomIdTrimmed.trim();
  const sid = scheduleId;
  const sidOk = typeof sid === "number" && Number.isFinite(sid);
  const itemOk =
    typeof segmentSourceItemId === "number" &&
    Number.isFinite(segmentSourceItemId);
  const fp = fingerprintTrimmed.trim();

  const keyEligible =
    flags.segmentReady && rid.length > 0 && sidOk && itemOk;

  const network =
    typeof flags.networkEnabled === "boolean"
      ? flags.networkEnabled
      : flags.segmentReady;

  const enabled = keyEligible && network;

  const keyRoom = rid.length > 0 ? rid : null;
  const keySchedule = sidOk ? sid : null;
  const keySegment = itemOk ? segmentSourceItemId : null;
  const keyMode =
    sidOk && itemOk && rid.length > 0 ? travelMode : null;

  const sessionSeed: RouteCached | undefined =
    fp.length > 0 &&
    typeof window !== "undefined" &&
    keyEligible &&
    rid.length > 0
      ? readScheduleRouteFromSessionStorage(
          rid,
          sid!,
          segmentSourceItemId!,
          travelMode,
          fp,
        )
      : undefined;

  return {
    queryKey: scheduleItemRouteQueryKey(
      keyRoom,
      keySchedule,
      keySegment,
      keyMode,
    ),
    ...(sessionSeed !== undefined
      ? {
          initialData: sessionSeed,
          initialDataUpdatedAt: typeof window !== "undefined" ? Date.now() : 0,
        }
      : {}),
    queryFn: (): Promise<RouteCached> =>
      resolveScheduleSegmentRoute({
        roomId: rid,
        scheduleId: sid!,
        segmentSourceItemId: segmentSourceItemId!,
        travelMode,
        scheduleFingerprint: fp,
      }),
    enabled,
    /** batch·sessionStorage 시딩 후에는 캐시 우선 — 명시 invalidate 시에만 재조회 */
    staleTime: 1000 * 60 * 60 * 6,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
  };
}

/**
 * 지도 구간 경로 — 목록과 같은 경로 쿼리를 쓴다(진행 중이면 합류). 방금 받다가 실패한 구간은 다시 보내지 않고
 * 가진 값(없으면 null)을 쓴다 — 실패(429·5xx) 직후 같은 구간을 지도가 또 요청하지 않게 한다.
 */
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
