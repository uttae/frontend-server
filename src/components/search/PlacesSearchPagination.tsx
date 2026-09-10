"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

type PlacesSearchPaginationProps = {
  hasPrevious: boolean;
  hasNext: boolean;
  pageLabel: string;
  onPrevious: () => void;
  onNext: () => void;
  disabled?: boolean;
};

export function PlacesSearchPagination({
  hasPrevious,
  hasNext,
  pageLabel,
  onPrevious,
  onNext,
  disabled = false,
}: PlacesSearchPaginationProps) {
  return (
    <nav
      aria-label="검색 결과 페이지"
      className="grid w-full min-w-0 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 bg-white px-5 pb-4 pt-3"
    >
      <div className="flex min-w-0 justify-start">
        {hasPrevious ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onPrevious}
            className={cn(
              "inline-flex h-9 cursor-pointer items-center gap-1 rounded-full border border-gray-border bg-white px-3 text-[15px] font-semibold text-dark-gray shadow-sm transition hover:border-primary/40 hover:text-primary-strong disabled:cursor-not-allowed disabled:opacity-45",
            )}
            aria-label="이전 페이지"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
            <span>이전</span>
          </button>
        ) : null}
      </div>

      <span className="shrink-0 rounded-full bg-primary/[0.08] px-3 py-1.5 text-center text-[14px] font-semibold text-primary-strong">
        {pageLabel}
      </span>

      <div className="flex min-w-0 justify-end">
        {hasNext ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onNext}
            className={cn(
              "inline-flex h-9 cursor-pointer items-center gap-1 rounded-full border border-gray-border bg-white px-3 text-[15px] font-semibold text-dark-gray shadow-sm transition hover:border-primary/40 hover:text-primary-strong disabled:cursor-not-allowed disabled:opacity-45",
            )}
            aria-label="다음 페이지"
          >
            <span>다음</span>
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
          </button>
        ) : null}
      </div>
    </nav>
  );
}
