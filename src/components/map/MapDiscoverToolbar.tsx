"use client";

import { type ReactNode } from "react";
import { flushSync } from "react-dom";

import { CircleCancelIcon, CloseIcon, SearchIcon } from "@/assets/icons";
import { Chip } from "@/components/ui/chip";
import { useMobileView } from "@/contexts/MobileViewContext";
import { useMobileMapSearchStore } from "@/stores/mobile-map-search-store";

import { useMapToolbarLayout } from "@/contexts/MapToolbarLayoutContext";
import {
  MAP_TOOLBAR_Z_CLASS,
} from "@/lib/layout/mapDetailPanelLayout";
import { cn } from "@/lib/utils";

import MapFilter from "./MapFilter";
import { MapChipToggle } from "./MapChipToggle";
import { MAP_PLACE_CATEGORIES } from "./map-place-categories";
import { MapCategoryChips } from "./MapCategoryChips";
import type { OpenValue, RatingValue } from "./map-filters";

type MapDiscoverToolbarProps = {
  hidden?: boolean;
  search?: ReactNode;
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
  rating: RatingValue;
  openNow: OpenValue;
  setRating: (v: RatingValue) => void;
  setOpenNow: (v: OpenValue) => void;
};

export function MapDiscoverToolbar({
  hidden = false,
  search,
  selectedCategoryId,
  onSelectCategory,
  rating,
  openNow,
  setRating,
  setOpenNow,
}: MapDiscoverToolbarProps) {
  const { setToolbarRef } = useMapToolbarLayout();
  const { isMobileDevice } = useMobileView();
  const category = MAP_PLACE_CATEGORIES.find((item) => item.id === selectedCategoryId);
  function resetCategory() {
    onSelectCategory(null);
    setRating("all");
    setOpenNow("all");
  }

  return (
    <div ref={setToolbarRef} hidden={hidden}
      className={cn("map-discover-toolbar pointer-events-none absolute inset-x-0 top-0 px-6 py-3 mobile:px-5", MAP_TOOLBAR_Z_CLASS)}>
      {isMobileDevice ? <MobileMapSearchBar /> : null}
      <div className="flex min-h-12 min-w-0 flex-nowrap items-center gap-6">
        <div className="pointer-events-auto min-w-0 flex-1">
          <div className="-my-2 overflow-x-auto py-2 drop-shadow-[0_2px_5px_#0000001a] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {category ? (
              <div className="flex w-max flex-nowrap items-center gap-1.5">
                <MapChipToggle pressed onPressedChange={resetCategory}>
                  <category.icon className="text-primary-strong"/><span>{category.label}</span>
                </MapChipToggle>
                <MapFilter rating={rating} openNow={openNow} setRating={setRating} setOpenNow={setOpenNow}/>
                <Chip variant="outline" size="md" className="w-9 px-0"
                  render={<button type="button" aria-label="카테고리 필터 초기화" onClick={resetCategory}/>}>
                  <CloseIcon/>
                </Chip>
              </div>
            ) : <MapCategoryChips selectedCategoryId={selectedCategoryId} onSelectCategory={onSelectCategory}/>}
          </div>
        </div>
        {!isMobileDevice ? search : null}
      </div>
    </div>
  );
}

function MobileMapSearchBar() {
  const textQuery = useMobileMapSearchStore((s) => s.textQuery);
  const clearTextSearch = useMobileMapSearchStore((s) => s.clearTextSearch);

  function handleOpen() {
    const { openSearch } = useMobileMapSearchStore.getState();
    flushSync(openSearch);
    useMobileMapSearchStore.getState().focusInput?.();
  }

  return (
    <div className="pointer-events-auto mb-3 flex h-11 w-full items-center rounded-[28px] bg-fill-subtle pr-2.5">
      <button
        type="button"
        onClick={handleOpen}
        className="flex h-full min-w-0 flex-1 items-center gap-[9px] pl-[15px] text-left"
      >
        <SearchIcon size={19} className="shrink-0 text-icon-subtle" />
        <span
          className={cn(
            "truncate pr-1 text-body-m-regular",
            textQuery ? "font-semibold text-text" : "text-text-subtle",
          )}
        >
          {textQuery || "장소 검색"}
        </span>
      </button>
      {textQuery ? (
        <button
          type="button"
          onClick={clearTextSearch}
          aria-label="검색 결과 지우기"
          className="flex h-11 w-8 shrink-0 items-center justify-center"
        >
          <CircleCancelIcon size={20} className="text-icon-subtle" />
        </button>
      ) : null}
    </div>
  );
}
