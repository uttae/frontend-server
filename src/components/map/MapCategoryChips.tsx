"use client";

import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

import { MAP_PLACE_CATEGORIES } from "./map-place-categories";

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
  return (
    <div
      className={cn(
        "pointer-events-auto flex min-w-0 max-w-full flex-nowrap gap-1.5",
        className,
      )}
    >
      {MAP_PLACE_CATEGORIES.map((cat) => (
        <Chip
          key={cat.id}
          variant="outline"
          size="md"
          pressed={selectedCategoryId === cat.id}
          onPressedChange={(pressed) => onSelectCategory(pressed ? cat.id : null)}
        >
          <cat.icon />
          <span>{cat.label}</span>
        </Chip>
      ))}
    </div>
  );
}
