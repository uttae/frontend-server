import { cn } from "@/lib/utils";

/** Figma Route Info의 Line — 14px 칸 오른쪽 끝의 세로 선. 구간 줄 높이만큼 늘어난다 */
export const PLAN_SEGMENT_RAIL_CLASS =
  "relative w-3.5 shrink-0 self-stretch border-r border-border";

/**
 * 레일 `+`·`−` — 세로 선 위 가운데에 놓는 24px 정원 버튼. 선 오른쪽 이동 줄·장소 추가 칸에 걸쳐도 위에 보이게 z를 둔다.
 * `−`의 테두리는 안쪽(border)이라 `+`와 같은 24px다
 */
export function planSegmentAddButtonClassName(active: boolean) {
  return cn(
    "absolute right-0 top-1/2 z-10 flex size-6 shrink-0 translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full shadow-sm transition-[background-color,opacity]",
    active
      ? "border-2 border-primary bg-white text-primary hover:bg-gray-50"
      : "bg-primary text-white hover:opacity-95",
  );
}
