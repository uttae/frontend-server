"use client";

import { MapSearchIcon } from "./MapSearchIcon";

import { cn } from "@/lib/utils";

import { MAP_PLACE_CATEGORIES } from "./map-place-categories";
import { mapChipButtonClassName } from "./map-chip-button";

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
        "pointer-events-auto flex min-w-0 max-w-full flex-nowrap gap-1.5",
        className,
      )}
    >
      {MAP_PLACE_CATEGORIES.map((cat) => {
        const active = selectedCategoryId === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => handleChipClick(cat.id)}
            aria-pressed={active}
            className={cn(
              "flex items-center gap-1.5",
              mapChipButtonClassName(active),
            )}
          >
            <MapSearchIcon name={cat.icon}/>
            <span>{cat.label}</span>
          </button>
        );
      })}
    </div>
  );
}
