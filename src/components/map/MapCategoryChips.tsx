"use client";

import { cn } from "@/lib/utils";

import { MapChipToggle } from "./MapChipToggle";
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
        <MapChipToggle
          key={cat.id}
          pressed={selectedCategoryId === cat.id}
          onPressedChange={(pressed) => onSelectCategory(pressed ? cat.id : null)}
        >
          {/* 카테고리 아이콘은 선택과 상관없이 파란색이다(교체 전 지도 칩 아이콘 #005bd9) */}
          <cat.icon className="text-primary-strong" />
          <span>{cat.label}</span>
        </MapChipToggle>
      ))}
    </div>
  );
}
