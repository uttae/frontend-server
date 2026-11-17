import { cn } from "@/lib/utils";

/** Figma Route Info의 Line — 14px 칸 오른쪽 끝의 세로 선. 구간 줄 높이만큼 늘어난다 */
export const PLAN_SEGMENT_RAIL_CLASS =
  "relative w-3.5 shrink-0 self-stretch border-r border-border";

/** 레일 `+`·`−` — 세로 선 위 가운데에 놓는 24px 정원 버튼. 선 오른쪽 이동 아이콘과 겹치지 않는 크기다 */
export function planSegmentAddButtonClassName(active: boolean) {
  return cn(
    "absolute right-0 top-1/2 flex size-6 shrink-0 translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full shadow-sm transition-[background-color,opacity,box-shadow]",
    active
      ? "bg-white text-primary ring-2 ring-primary ring-offset-1 hover:bg-gray-50"
      : "bg-primary text-white hover:opacity-95",
  );
}
