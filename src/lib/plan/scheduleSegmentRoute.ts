import type { ScheduleItemRouteResponse } from "@/lib/api/rooms";
import { getScheduleItemRoute } from "@/lib/api/rooms";
import { awaitScheduleRoutesBatch } from "@/lib/plan/schedule-bulk-hydration";
import { writeScheduleRouteToSessionStorage } from "@/lib/plan/planTravelLocalStorage";
import type { ScheduleTravelModeValue } from "@/lib/plan/scheduleTravelMode";
import { getQueryClient } from "@/lib/query-client";
import { scheduleItemRouteQueryKey } from "@/lib/query-keys";

/** `null` — 마지막 항목이거나 경로 없음(204) */
export type ScheduleSegmentRoute = ScheduleItemRouteResponse | null;

export type ResolveScheduleSegmentRouteArgs = {
  roomId: string;
  scheduleId: number;
  segmentSourceItemId: number;
  /** 다음 장소의 `googlePlaceId` — 캐시 key에만 쓴다(서버는 출발 항목의 다음 항목으로 계산) */
  destinationPlaceId: string;
  travelMode: ScheduleTravelModeValue;
  /** 일정 지문 — 비면 sessionStorage에 기록하지 않습니다. */
  scheduleFingerprint?: string;
};

/**
 * 구간 `(room, schedule, 출발 항목, 도착 장소, 이동수단)` 경로를 가져오는 fetch 본체입니다.
 * 거리·소요 시간과 지도 폴리라인이 같은 캐시 항목을 공유하도록 일정 리스트와 지도가 모두
 * 이 함수를 queryFn으로 쓰는 하나의 쿼리(`scheduleItemRouteQueryKey`)를 거칩니다.
 *
 * in-flight 합치기와 재정렬 중 뒤늦게 도착한 응답 폐기는 React Query가 담당합니다.
 * 여기서 직접 캐시에 쓰지 않습니다 — `setQueryData`는 무효화 플래그까지 지워서
 * 순서가 바뀐 뒤의 낡은 경로를 유효한 값으로 만들어 버립니다.
 */
export async function resolveScheduleSegmentRoute({
  roomId,
  scheduleId,
  segmentSourceItemId,
  destinationPlaceId,
  travelMode,
  scheduleFingerprint,
}: ResolveScheduleSegmentRouteArgs): Promise<ScheduleSegmentRoute> {
  const rid = roomId.trim();
  if (!rid.length) return null;

  /** 저장 이동수단 기준 batch가 이 구간·수단을 시딩했을 수 있어 완료를 기다림 */
  await awaitScheduleRoutesBatch(rid, scheduleId);

  const routeKey = scheduleItemRouteQueryKey(
    rid,
    scheduleId,
    segmentSourceItemId,
    destinationPlaceId,
    travelMode,
  );
  const cached = getQueryClient()?.getQueryState<ScheduleSegmentRoute>(routeKey);
  if (cached?.data !== undefined && !cached.isInvalidated) {
    return cached.data;
  }

  const fresh = await getScheduleItemRoute(
    rid,
    scheduleId,
    segmentSourceItemId,
    travelMode,
  );

  const fp = scheduleFingerprint?.trim() ?? "";
  if (fp.length > 0) {
    writeScheduleRouteToSessionStorage(
      rid,
      scheduleId,
      segmentSourceItemId,
      travelMode,
      fp,
      fresh,
    );
  }

  return fresh;
}
