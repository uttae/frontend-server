import { Spinner } from "@/components/ui/spinner";

import type { ScheduleItemRouteResponse } from "@/lib/api/rooms";
import { formatRouteDistance, formatRouteDuration } from "@/lib/plan/routeFormat";

type TravelRouteSummaryLineProps = {
  route: ScheduleItemRouteResponse | null | undefined;
  isPending: boolean;
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

  if (routeOk) {
    return (
      <>
        {formatRouteDuration(route.durationSeconds)}
        <span data-route-separator className="mx-1 text-light-gray">·</span>
        <span data-route-distance>{formatRouteDistance(route.distanceMeters)}</span>
      </>
    );
  }

  if (isFetching) {
    return (
      <Spinner aria-label="이동 시간 불러오는 중" size={16} />
    );
  }

  if (isPending) {
    return (
      <Spinner aria-label="이동 시간 불러오는 중" size={16} />
    );
  }
  if (isError) return <span className="text-status-negative">경로 조회 오류</span>;
  if (routeUnavailable) return "이동 안내 없음";
  return "다음 장소로 이동";
}
