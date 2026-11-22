import { cn } from "@/lib/utils";

export const PLAN_SEGMENT_RAIL_CLASS = "relative w-3.5 shrink-0 self-stretch border-r border-border";

export function planSegmentAddButtonClassName(active: boolean) {
  return cn(
    "absolute right-0 top-1/2 z-10 flex size-6 shrink-0 translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full shadow-sm transition-[background-color,opacity]",
    active
      ? "border-2 border-primary bg-white text-primary hover:bg-gray-50"
      : "bg-primary text-white hover:opacity-95",
  );
}
