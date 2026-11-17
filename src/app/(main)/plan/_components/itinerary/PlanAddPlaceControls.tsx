"use client";

import { SavedIcon } from "@/assets/icons";
import { PlacesSearchInput } from "@/components/search/PlacesSearchInput";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PlanAddPlaceControlsProps = {
  coords: { lat: number; lng: number } | null;
  disabled?: boolean;
  onPickPrediction: (prediction: google.maps.places.PlacePrediction) => void;
  onOpenBookmark: () => void;
  className?: string;
};

// Figma Add Place는 "장소 추가" 버튼이지만, 지금 동작(입력하면 바로 자동완성)을 지키려고 검색 입력에 Figma 아이콘·문구만 맞춘다
export function PlanAddPlaceControls({
  coords,
  disabled = false,
  onPickPrediction,
  onOpenBookmark,
  className,
}: PlanAddPlaceControlsProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="min-w-0 flex-1">
        <PlacesSearchInput
          coords={coords}
          pickOnly
          leadingIcon="plus"
          placeholder="장소 추가"
          disabled={disabled}
          onSearch={() => {}}
          onPickPrediction={onPickPrediction}
        />
      </div>
      <Button
        variant="outline"
        tone="brand"
        size="md"
        aria-label="북마크에서 장소 추가"
        disabled={disabled}
        onClick={onOpenBookmark}
        // Figma 인스턴스가 둥글기만 999로 바꾼 48×48 아이콘 버튼이다
        className="size-12 rounded-full px-0"
      >
        <SavedIcon />
      </Button>
    </div>
  );
}
