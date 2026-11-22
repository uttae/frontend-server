"use client";

import { cn } from "@/lib/utils";

import { MapChipToggle } from "./MapChipToggle";
import { MAP_PLACE_CATEGORIES } from "./map-place-categories";

type MapCategoryChipsProps = {
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
  className?: string;
};

export function MapCategoryChips({ selectedCategoryId, onSelectCategory, className }: Readonly<MapCategoryChipsProps>) {
  return (
    <div className={cn("pointer-events-auto flex min-w-0 max-w-full flex-nowrap gap-1.5", className)}>
      {MAP_PLACE_CATEGORIES.map((cat) => (
        <MapChipToggle
          key={cat.id}
          pressed={selectedCategoryId === cat.id}
          onPressedChange={(pressed) => onSelectCategory(pressed ? cat.id : null)}
        >
          <cat.icon className="text-primary-strong" />
          <span>{cat.label}</span>
        </MapChipToggle>
      ))}
    </div>
  );
}
