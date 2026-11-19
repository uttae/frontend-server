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
        className="size-12 rounded-full px-0"
      >
        <SavedIcon />
      </Button>
    </div>
  );
}
