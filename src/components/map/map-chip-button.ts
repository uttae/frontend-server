import { cn } from "@/lib/utils";

const mapChipButtonBaseClass =
  "shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-[14px] font-medium shadow-md transition-[background-color,color,opacity,box-shadow] duration-200";

/** 지도 필터 칩 — 미적용(전체·영업 중 off) */
export function mapFilterChipInactiveClassName() {
  return cn(
    mapChipButtonBaseClass,
    "bg-white text-gray ring-2 ring-light-gray ring-offset-1 hover:bg-gray-50 active:opacity-90",
  );
}

/** 지도 필터 칩 — 값 선택됨(평점 등) */
export function mapFilterChipActiveRingClassName() {
  return cn(
    mapChipButtonBaseClass,
    "bg-white text-primary ring-2 ring-primary ring-offset-1 hover:bg-gray-50 active:opacity-90",
  );
}

/** 지도 필터 칩 — 토글 on(영업 중) */
export function mapFilterChipActiveFilledClassName() {
  return cn(
    mapChipButtonBaseClass,
    "bg-primary text-white hover:opacity-95 active:opacity-90",
  );
}

/** 기본: 앱 primary(red/white). active: 흰 배경 + red ring으로 선택 구분 */
export function mapChipButtonClassName(active: boolean) {
  return cn(
    mapChipButtonBaseClass,
    active
      ? "bg-white text-primary ring-2 ring-primary ring-offset-1 hover:bg-gray-50 active:opacity-90"
      : "bg-primary text-white hover:opacity-95 active:opacity-90",
  );
}
