import { LoadingIndicator } from "@/components/loading/LoadingIndicator";

import type { ScheduleItemRouteResponse } from "@/lib/api/rooms";
import { formatRouteDistance, formatRouteDuration } from "@/lib/plan/routeFormat";

type TravelRouteSummaryLineProps = {
  route: ScheduleItemRouteResponse | null | undefined;
  isPending: boolean;
  /** 표시 가능한 경로가 없는 동안에만 조회 상태를 표시한다. */
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
      <LoadingIndicator label="이동 시간 불러오는 중" size={14} />
    );
  }

  if (isPending) {
    return (
      <LoadingIndicator label="이동 시간 불러오는 중" size={14} />
    );
  }
  if (isError) return "이동 시간을 불러오지 못했어요";
  if (routeUnavailable) return "이동 안내 없음";
  return "다음 장소로 이동";
}
