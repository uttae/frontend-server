"use client";

import { RefreshCw } from "lucide-react";

type SearchHereFloatingButtonProps = {
  visible: boolean;
  onPress: () => void;
};

export function SearchHereFloatingButton({
  visible,
  onPress,
}: SearchHereFloatingButtonProps) {
  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute bottom-6 left-1/2 z-[17] -translate-x-1/2">
      <button
        type="button"
        onClick={onPress}
        className="pointer-events-auto inline-flex cursor-pointer items-center gap-1 rounded-full border-3 border-primary bg-white px-3 py-2 text-[14px] font-semibold text-dark-gray shadow-md transition hover:bg-gray-50"
      >
        <RefreshCw
          className="h-4 w-4 shrink-0 text-primary"
          strokeWidth={2.2}
          aria-hidden
        />
        현 위치에서 검색
      </button>
    </div>
  );
}
