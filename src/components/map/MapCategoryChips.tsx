"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

import { MAP_PLACE_CATEGORIES } from "./map-place-categories";
import { mapChipButtonClassName } from "./map-chip-button";
import { mapChipSpring } from "./map-toolbar-motion";

type MapCategoryChipsProps = {
  selectedCategoryId: string | null;
  /** 같은 칩을 다시 누르면 `null`로 해제 */
  onSelectCategory: (id: string | null) => void;
  className?: string;
};

export function MapCategoryChips({
  selectedCategoryId,
  onSelectCategory,
  className,
}: MapCategoryChipsProps) {
  function handleChipClick(categoryId: string) {
    if (selectedCategoryId === categoryId) onSelectCategory(null);
    else onSelectCategory(categoryId);
  }

  return (
    <div
      className={cn(
        "pointer-events-auto -mx-1 flex min-w-0 max-w-full flex-wrap gap-2 pb-0.5",
        "mobile:-mx-4 mobile:max-w-none mobile:flex-nowrap mobile:overflow-x-auto mobile:px-4 mobile:py-1",
        "mobile:[scrollbar-width:none] mobile:[&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {MAP_PLACE_CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const active = selectedCategoryId === cat.id;
        return (
          <motion.button
            key={cat.id}
            type="button"
            onClick={() => handleChipClick(cat.id)}
            whileTap={{ scale: 0.94 }}
            whileHover={{ scale: 1.02 }}
            transition={mapChipSpring}
            className={cn(
              "flex items-center gap-1.5",
              mapChipButtonClassName(active),
            )}
          >
            <Icon
              className="h-3.5 w-3.5 shrink-0"
              aria-hidden
              strokeWidth={2}
            />
            <span>{cat.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
