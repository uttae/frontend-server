/** `pl-1` + `w-8` 레일 중앙 — 구간 세로선 위치 */
export const PLAN_SEGMENT_RAIL_LINE_CLASS =
  "pointer-events-none absolute inset-y-0 left-5 w-px -translate-x-1/2 bg-gradient-to-b from-gray-border via-light-gray to-gray-border";

import { cn } from "@/lib/utils";

/** summary 행(`TravelDirectionsCard` 토글)과 동일한 앵커 높이 */
export const PLAN_SEGMENT_RAIL_ROW_CLASS =
  "relative flex h-10 w-8 shrink-0 items-center justify-center";

/** 레일 `+` — `mapChipButtonClassName`의 px/py 없이 정원 유지 */
export function planSegmentAddButtonClassName(active: boolean) {
  return cn(
    "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full shadow-sm transition-[background-color,opacity,box-shadow]",
    active
      ? "bg-white text-primary ring-2 ring-primary ring-offset-1 hover:bg-gray-50"
      : "bg-primary text-white hover:opacity-95",
  );
}
