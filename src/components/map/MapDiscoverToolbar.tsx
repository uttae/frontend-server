"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

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
        "pointer-events-none absolute inset-x-0 top-0 mt-4 max-w-full overflow-visible px-4",
        ratingDropdownOpen ? MAP_TOOLBAR_ELEVATED_Z_CLASS : MAP_TOOLBAR_Z_CLASS,
      )}
    >
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
