"use client";

import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/** 지도 하단 「현 위치에서 검색」 알약 모양. 같은 자리의 「검색 결과가 없어요」 안내도 이 모양을 쓴다 */
export const searchHerePillClass =
  "pointer-events-auto inline-flex items-center gap-1 rounded-full border-3 border-primary bg-white px-3 py-2 text-label-m-emphasis mobile:text-label-s-emphasis font-semibold text-dark-gray shadow-md";

type SearchHereFloatingButtonProps = {
  label: string;
  onPress: () => void;
};

export function SearchHereFloatingButton({
  label,
  onPress,
}: SearchHereFloatingButtonProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={cn(searchHerePillClass, "cursor-pointer transition hover:bg-gray-50")}
    >
      <RefreshCw
        className="h-4 w-4 shrink-0 text-primary"
        strokeWidth={2.2}
        aria-hidden
      />
      {label}
    </button>
  );
}
