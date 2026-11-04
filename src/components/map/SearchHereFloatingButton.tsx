"use client";

import { RefreshCw } from "lucide-react";

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
      className="pointer-events-auto inline-flex cursor-pointer items-center gap-1 rounded-full border-3 border-primary bg-white px-3 py-2 text-label-m-emphasis mobile:text-label-s-emphasis font-semibold text-dark-gray shadow-md transition hover:bg-gray-50"
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
