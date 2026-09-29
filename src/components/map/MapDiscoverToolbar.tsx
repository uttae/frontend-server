"use client";

import { useState } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

import { CircleCancelIcon, SearchIcon } from "@/assets/icons";
import { useMobileView } from "@/contexts/MobileViewContext";
import { useMobileMapSearchStore } from "@/stores/mobile-map-search-store";

import { useMapToolbarLayout } from "@/contexts/MapToolbarLayoutContext";
import {
  MAP_TOOLBAR_ELEVATED_Z_CLASS,
  MAP_TOOLBAR_Z_CLASS,
} from "@/lib/layout/mapDetailPanelLayout";
import { cn } from "@/lib/utils";

import MapFilter from "./MapFilter";
import { MapCategoryChips } from "./MapCategoryChips";
import type { OpenValue, RatingValue } from "./map-filters";
import { mapToolbarPanelMotion } from "./map-toolbar-motion";

type MapDiscoverToolbarProps = {
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
  rating: RatingValue;
  openNow: OpenValue;
  setRating: (v: RatingValue) => void;
  setOpenNow: (v: OpenValue) => void;
};

export function MapDiscoverToolbar({
  selectedCategoryId,
  onSelectCategory,
  rating,
  openNow,
  setRating,
  setOpenNow,
}: MapDiscoverToolbarProps) {
  const { setToolbarRef } = useMapToolbarLayout();
  const { isMobileDevice } = useMobileView();
  const [ratingDropdownOpen, setRatingDropdownOpen] = useState(false);

  const [previousCategoryId, setPreviousCategoryId] = useState(selectedCategoryId);
  if (previousCategoryId !== selectedCategoryId) {
    setPreviousCategoryId(selectedCategoryId);
    if (selectedCategoryId == null) setRatingDropdownOpen(false);
  }

  return (
    <div
      ref={setToolbarRef}
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 mt-4 max-w-full overflow-visible px-4 mobile:mt-3 mobile:px-5",
        ratingDropdownOpen ? MAP_TOOLBAR_ELEVATED_Z_CLASS : MAP_TOOLBAR_Z_CLASS,
      )}
    >
      {isMobileDevice ? <MobileMapSearchBar /> : null}
      <AnimatePresence mode="wait" initial={false}>
        {selectedCategoryId == null ? (
          <motion.div
            key="chips"
            className="w-full min-w-0 max-w-full"
            {...mapToolbarPanelMotion}
          >
            <MapCategoryChips
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={onSelectCategory}
            />
          </motion.div>
        ) : (
          <motion.div
            key="filter"
            className="pointer-events-auto -mx-1 flex min-w-0 max-w-full flex-wrap items-center gap-2 pb-0.5"
            {...mapToolbarPanelMotion}
          >
            <MapFilter
              rating={rating}
              openNow={openNow}
              setRating={setRating}
              setOpenNow={setOpenNow}
              onRatingDropdownOpenChange={setRatingDropdownOpen}
            />
            <button
              type="button"
              onClick={() => onSelectCategory(null)}
              aria-label="카테고리 닫기"
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-dark-gray shadow-md transition hover:bg-gray-50"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** 모바일 지도 상단 검색바 — 누르면 전체 화면 검색(`MobileMapSearch`)을 연다. 엔터 검색 중이면 검색어와 지우기 버튼을 보여준다 */
function MobileMapSearchBar() {
  const textQuery = useMobileMapSearchStore((s) => s.textQuery);
  const clearTextSearch = useMobileMapSearchStore((s) => s.clearTextSearch);

  function handleOpen() {
    const { openSearch } = useMobileMapSearchStore.getState();
    // 검색 화면을 먼저 그린 뒤 같은 탭 안에서 focus해야 iOS에서도 키보드가 뜬다
    flushSync(openSearch);
    useMobileMapSearchStore.getState().focusInput?.();
  }

  return (
    <div className="pointer-events-auto mb-3 flex h-12 w-full items-center rounded-full border border-border bg-fill-subtle pr-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
      <button
        type="button"
        onClick={handleOpen}
        className="flex h-full min-w-0 flex-1 items-center gap-2 pl-3.5 text-left"
      >
        <SearchIcon size={20} className="text-icon-subtle" />
        <span
          className={cn(
            "truncate pr-1 text-body-m-regular",
            textQuery ? "text-text" : "text-text-subtle",
          )}
        >
          {textQuery || "떠나고 싶은 지역을 입력해주세요"}
        </span>
      </button>
      {textQuery ? (
        <button
          type="button"
          onClick={clearTextSearch}
          aria-label="검색 결과 지우기"
          className="flex h-12 w-8 shrink-0 items-center justify-center"
        >
          <CircleCancelIcon size={20} className="text-icon-subtle" />
        </button>
      ) : null}
    </div>
  );
}
