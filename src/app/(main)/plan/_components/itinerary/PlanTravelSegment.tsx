"use client";

import type { ReactNode } from "react";

import { TravelRouteRail } from "@/app/(main)/plan/_components/travel-time/TravelRouteRail";

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
    <div data-plan-insert-slot className="group/segment flex gap-2">
      <TravelRouteRail
        showAddOnHover={!addDisabled && !isActive}
        isAddVisible={isActive}
        onAddClick={onActivate}
        addDisabled={addDisabled}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-h-10 items-center pr-3">{children}</div>
        {showAddControls && addControls ?
          <div className="pb-2">{addControls}</div>
        : null}
      </div>
    </div>
  );
}
