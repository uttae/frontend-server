import { Trash2 } from "lucide-react";

import { PLAN_PLACE_CARD_TW } from "@/lib/layout-tokens";
import { cn } from "@/lib/utils";

/** 카드 D&D·지도 선택과 겹치지 않게 할 인터랙티브 영역 */
export const PLAN_PLACE_CARD_INTERACTIVE_SELECTOR =
  "textarea, input, select, button, a, [data-plan-card-no-drag]";

export function isPlanPlaceCardInteractiveTarget(
  target: EventTarget | null,
): boolean {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest(PLAN_PLACE_CARD_INTERACTIVE_SELECTOR))
  );
}

export function PlanOrderIndexBadge({
  orderIndex,
  backgroundColorHex,
  className,
}: {
  orderIndex: number;
  /** 지도 일차 경로색과 동일한 hex — 유효하지 않으면 primary 클래스 */
  backgroundColorHex?: string;
  className?: string;
}) {
  const hex =
    typeof backgroundColorHex === "string" ?
      backgroundColorHex.trim()
    : "";
  const customBg =
    hex.length === 7 && hex.startsWith("#") && /^#[0-9a-fA-F]{6}$/.test(hex);

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md font-bold text-white",
        PLAN_PLACE_CARD_TW.orderBadgeCompact,
        !customBg && "bg-primary",
        className,
      )}
      style={customBg ? { backgroundColor: hex } : undefined}
      aria-label={`${orderIndex}번째 장소`}
    >
      {orderIndex}
    </span>
  );
}

export function PlanScheduleItemDeleteButton({
  disabled,
  onDelete,
}: {
  disabled: boolean;
  onDelete: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "shrink-0 cursor-pointer rounded-lg text-dark-gray transition hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40",
        PLAN_PLACE_CARD_TW.deleteButtonCompact,
      )}
      aria-label="일정에서 삭제"
      disabled={disabled}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onDelete();
      }}
    >
      <Trash2
        className={PLAN_PLACE_CARD_TW.deleteIconCompact}
        strokeWidth={2}
        aria-hidden
      />
    </button>
  );
}
