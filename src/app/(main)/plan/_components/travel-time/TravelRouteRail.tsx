import { ArrowDown, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  PLAN_SEGMENT_RAIL_ROW_CLASS,
  planSegmentAddButtonClassName,
} from "./travelSegmentRailLayout";

type TravelRouteRailProps = {
  /** 화살표 색 — `text-primary` / `text-light-gray` 등 */
  arrowClassName: string;
  className?: string;
  /** summary 행과 높이 맞춤(기본) | 슬롯 활성 시 전체 높이 + 중앙 + */
  layout?: "row" | "fillHeight";
  showAddOnHover?: boolean;
  isAddVisible?: boolean;
  onAddClick?: () => void;
  addDisabled?: boolean;
};

const addButtonClass = (active: boolean, extra?: string) =>
  cn(
    planSegmentAddButtonClassName(active),
    "relative z-[1]",
    extra,
  );

export function TravelRouteRail({
  arrowClassName,
  className,
  layout = "row",
  showAddOnHover = false,
  isAddVisible = false,
  onAddClick,
  addDisabled = false,
}: TravelRouteRailProps) {
  const showAddControl = showAddOnHover || isAddVisible;

  if (layout === "fillHeight") {
    return (
      <div
        className={cn(
          "relative flex w-8 shrink-0 self-stretch",
          className,
        )}
      >
        {showAddControl ?
          <button
            type="button"
            aria-label="이 위치에 장소 추가"
            disabled={addDisabled}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onAddClick?.();
            }}
            className={addButtonClass(
              true,
              cn("m-auto", addDisabled && "pointer-events-none opacity-40"),
            )}
          >
            <Plus className="h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden />
          </button>
        : null}
      </div>
    );
  }

  return (
    <div className={cn(PLAN_SEGMENT_RAIL_ROW_CLASS, className)}>
      <div
        className={cn(
          "flex items-center justify-center",
          showAddControl &&
            (isAddVisible ?
              "opacity-0"
            : "opacity-100 group-hover/segment:opacity-0"),
        )}
      >
        <ArrowDown
          className={cn("h-4 w-4 shrink-0", arrowClassName)}
          aria-hidden
        />
      </div>
      {showAddControl ?
        <button
          type="button"
          aria-label="이 위치에 장소 추가"
          disabled={addDisabled}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onAddClick?.();
          }}
          className={addButtonClass(
            isAddVisible,
            cn(
              "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 transition-opacity",
              showAddOnHover && "group-hover/segment:opacity-100",
              isAddVisible && "opacity-100",
              addDisabled && "pointer-events-none opacity-40",
            ),
          )}
        >
          <Plus className="h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden />
        </button>
      : null}
    </div>
  );
}
