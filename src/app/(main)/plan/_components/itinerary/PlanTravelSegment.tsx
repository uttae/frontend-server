"use client";

import type { ReactNode } from "react";

import { TravelRouteRail } from "@/app/(main)/plan/_components/travel-time/TravelRouteRail";
import {
  PLAN_SEGMENT_RAIL_LINE_CLASS,
} from "@/app/(main)/plan/_components/travel-time/travelSegmentRailLayout";
import { cn } from "@/lib/utils";

export type PlanTravelSegmentProps = {
  isActive: boolean;
  onActivate: () => void;
  addDisabled?: boolean;
  showAddControls?: boolean;
  addControls?: ReactNode;
  children: ReactNode;
};

export function PlanTravelSegment({
  isActive,
  onActivate,
  addDisabled = false,
  showAddControls = false,
  addControls,
  children,
}: PlanTravelSegmentProps) {
  return (
    <div data-plan-insert-slot className="group/segment relative pl-1">
      <div className={PLAN_SEGMENT_RAIL_LINE_CLASS} aria-hidden />
      <div className="relative flex gap-1">
        <TravelRouteRail
          layout={isActive ? "fillHeight" : "row"}
          className={isActive ? "self-stretch" : undefined}
          arrowClassName="text-primary"
          showAddOnHover={!addDisabled && !isActive}
          isAddVisible={isActive}
          onAddClick={onActivate}
          addDisabled={addDisabled}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-h-10 items-center">{children}</div>
          {showAddControls && addControls ?
            <div className={cn("bg-white px-1 pb-1 pt-0.5")}>{addControls}</div>
          : null}
        </div>
      </div>
    </div>
  );
}
