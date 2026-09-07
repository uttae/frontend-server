import { Loader2 } from "lucide-react";

import type { ScheduleItemRouteResponse } from "@/lib/api/rooms";
import { formatRouteDistance, formatRouteDuration } from "@/lib/plan/routeFormat";

type TravelRouteSummaryLineProps = {
  route: ScheduleItemRouteResponse | null | undefined;
  isPending: boolean;
  /** 재검증·무효화 후 재요청 중 — 이전 캐시 값 대신 로딩 표시 */
  isFetching: boolean;
  isError: boolean;
  routeUnavailable: boolean;
};

export function TravelRouteSummaryLine({
  route,
  isPending,
  isFetching,
  isError,
  routeUnavailable,
}: TravelRouteSummaryLineProps) {
  const routeOk =
    route != null &&
    route.durationSeconds >= 0 &&
    route.distanceMeters >= 0;

  /** 표시할 수 있는 값이 있으면 다른 쿼리의 `isFetching` 에 가리지 않음 */
  if (routeOk) {
    return (
      <>
        {formatRouteDuration(route.durationSeconds)}
        <span className="mx-1 text-light-gray">·</span>
        {formatRouteDistance(route.distanceMeters)}
      </>
    );
  }

  if (isFetching) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        불러오는 중…
      </span>
    );
  }

  if (isPending) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        불러오는 중…
      </span>
    );
  }
  if (isError) return "이동 시간을 불러오지 못했어요";
  if (routeUnavailable) return "이동 안내 없음";
  return "다음 장소로 이동";
}
