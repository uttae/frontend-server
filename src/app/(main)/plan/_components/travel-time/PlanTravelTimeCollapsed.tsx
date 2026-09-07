import { PLAN_ROUTE_CARD_WIDTH_PX } from "@/lib/layout-tokens";
import { cn } from "@/lib/utils";

import { TravelRouteRail } from "./TravelRouteRail";
import { PLAN_SEGMENT_RAIL_LINE_CLASS } from "./travelSegmentRailLayout";

type PlanTravelTimeCollapsedProps = {
  className?: string;
  contentOnly?: boolean;
  onShowDirections: () => void;
};

export function PlanTravelTimeCollapsed({
  className,
  contentOnly = false,
  onShowDirections,
}: PlanTravelTimeCollapsedProps) {
  const body = (
    <div
      className={cn(
        "flex shrink-0 items-center py-1",
        contentOnly ? "w-full" : undefined,
      )}
      style={contentOnly ? undefined : { width: PLAN_ROUTE_CARD_WIDTH_PX }}
    >
      <button
        type="button"
        className="cursor-pointer text-[14px] text-primary underline-offset-2 hover:underline"
        onClick={onShowDirections}
      >
        길찾기 표시
      </button>
    </div>
  );

  if (contentOnly) {
    return (
      <div className={cn(className)} role="separator">
        {body}
      </div>
    );
  }

  return (
    <div className={cn("relative py-0.5 pl-1", className)} role="separator">
      <div className={PLAN_SEGMENT_RAIL_LINE_CLASS} aria-hidden />
      <div className="relative flex min-h-10 items-center gap-3">
        <TravelRouteRail arrowClassName="text-light-gray" layout="row" />
        {body}
      </div>
    </div>
  );
}
