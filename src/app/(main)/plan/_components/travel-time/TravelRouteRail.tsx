import { Minus } from "lucide-react";

import { PlusIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";

import { PLAN_SEGMENT_RAIL_CLASS, planSegmentAddButtonClassName } from "./travelSegmentRailLayout";

type TravelRouteRailProps = {
  className?: string;
  showAddOnHover?: boolean;
  isAddVisible?: boolean;
  onAddClick?: () => void;
  addDisabled?: boolean;
};

export function TravelRouteRail({
  className,
  showAddOnHover = false,
  isAddVisible = false,
  onAddClick,
  addDisabled = false,
}: TravelRouteRailProps) {
  return (
    <div className={cn(PLAN_SEGMENT_RAIL_CLASS, className)}>
      {isAddVisible ? (
        <button
          type="button"
          aria-label="장소 추가 닫기"
          disabled={addDisabled}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onAddClick?.();
          }}
          className={cn(planSegmentAddButtonClassName(true), addDisabled && "pointer-events-none opacity-40")}
        >
          <Minus className="h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden />
        </button>
      ) : showAddOnHover ? (
        <button
          type="button"
          aria-label="이 위치에 장소 추가"
          disabled={addDisabled}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onAddClick?.();
          }}
          className={cn(
            planSegmentAddButtonClassName(false),
            "opacity-0 group-hover/segment:opacity-100",
            addDisabled && "pointer-events-none opacity-40",
          )}
        >
          <PlusIcon size={16} />
        </button>
      ) : null}
    </div>
  );
}
