import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * 긴 점선 테두리 — 감싼 `relative` 요소 위에 겹쳐 그린다.
 * CSS 점선은 점 길이를 못 바꿔서 SVG로 그린다. `active`면 primary 색(놓을 자리·넣을 자리)이다.
 */
export function DashedBorder({ active = false, className }: Readonly<{ active?: boolean; className?: string }>) {
  return (
    <svg aria-hidden className={cn("pointer-events-none absolute inset-0 size-full overflow-visible", className)}>
      <rect
        width="100%"
        height="100%"
        rx="6"
        fill="none"
        strokeWidth="1"
        strokeDasharray="8 6"
        className={cn("transition-colors", active ? "stroke-primary" : "stroke-border")}
      />
    </svg>
  );
}

/**
 * 비어 있는 자리를 알리는 긴 점선 박스 — 일정 화면의 빈 일차, 지도 경로 보기의 장소 없는 일차가 함께 쓴다.
 * `active`면 놓을 자리로 강조한다.
 */
export function DashedPlaceholderBox({
  active = false,
  className,
  children,
}: Readonly<{ active?: boolean; className?: string; children: ReactNode }>) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-md transition-colors",
        // primary-subtle은 이 영역에 너무 진해 한 단계 연한 원시 토큰을 쓴다
        active && "bg-[var(--blue-50)]",
        className,
      )}
    >
      <DashedBorder active={active} />
      {children}
    </div>
  );
}
