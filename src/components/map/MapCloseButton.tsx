import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/** 지도 위에 띄우는 작은 닫기 버튼 — 카테고리 탐색 닫기와 경로 보기 닫기가 함께 쓴다 */
export function MapCloseButton({
  label,
  onClick,
  className,
}: Readonly<{ label: string; onClick: () => void; className?: string }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-dark-gray shadow-md transition hover:bg-gray-50",
        className,
      )}
    >
      <X className="h-4 w-4" aria-hidden />
    </button>
  );
}
