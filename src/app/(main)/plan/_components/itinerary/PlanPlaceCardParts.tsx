import { MenuDotHorizontalIcon, TrashIcon } from "@/assets/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PLAN_PLACE_CARD_TW } from "@/lib/layout-tokens";
import { cn } from "@/lib/utils";

import { menuPointerBoundary } from "./PlanDaySection";

export const PLAN_PLACE_CARD_INTERACTIVE_SELECTOR = "textarea, input, select, button, a, [data-plan-card-no-drag]";

export function isPlanPlaceCardInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest(PLAN_PLACE_CARD_INTERACTIVE_SELECTOR));
}

export function PlanOrderIndexBadge({
  orderIndex,
  backgroundColorHex,
  className,
}: {
  orderIndex: number;
  backgroundColorHex?: string;
  className?: string;
}) {
  const hex = typeof backgroundColorHex === "string" ? backgroundColorHex.trim() : "";
  const customBg = hex.length === 7 && hex.startsWith("#") && /^#[0-9a-fA-F]{6}$/.test(hex);

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center",
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

export function PlanPlaceCardMenu({
  placeTitle,
  deleteDisabled,
  onDelete,
}: {
  placeTitle: string;
  deleteDisabled: boolean;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        {...menuPointerBoundary}
        aria-label={`${placeTitle} 메뉴`}
        className="-m-1 shrink-0 cursor-pointer rounded-md p-1 text-icon transition-colors hover:bg-fill aria-expanded:bg-fill"
      >
        <MenuDotHorizontalIcon size={20} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" {...menuPointerBoundary}>
        <DropdownMenuItem variant="destructive" disabled={deleteDisabled} onClick={onDelete}>
          <TrashIcon />
          삭제
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
