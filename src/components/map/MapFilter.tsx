import { FilterDropdown } from "@/components/filter-dropdown";
import { MAP_FILTER_DROPDOWN_MENU_Z_CLASS } from "@/lib/layout/mapDetailPanelLayout";

import { MapChipToggle } from "./MapChipToggle";
import {
  RATING_OPTIONS,
  type OpenValue,
  type RatingValue,
} from "./map-filters";
import { cn } from "@/lib/utils";

type MapFilterProps = {
  rating: RatingValue;
  openNow: OpenValue;
  setRating: (v: RatingValue) => void;
  setOpenNow: (v: OpenValue) => void;
  onRatingDropdownOpenChange?: (open: boolean) => void;
  className?: string;
};

export default function MapFilter({
  rating,
  openNow,
  setRating,
  setOpenNow,
  onRatingDropdownOpenChange,
  className,
}: MapFilterProps) {
  const isOpenOnly = openNow === "open";

  return (
    <div className={cn("flex flex-nowrap gap-1.5", className)}>
      <FilterDropdown
        label="평점"
        options={RATING_OPTIONS}
        value={rating}
        onChange={setRating}
        onOpenChange={onRatingDropdownOpenChange}
        menuClassName={MAP_FILTER_DROPDOWN_MENU_Z_CLASS}
      />
      <MapChipToggle
        pressed={isOpenOnly}
        onPressedChange={(pressed) => setOpenNow(pressed ? "open" : "all")}
      >
        영업 중
      </MapChipToggle>
    </div>
  );
}
