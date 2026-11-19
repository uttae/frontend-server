import { Select as SelectPrimitive } from "@base-ui/react/select";
import { useEffect, useRef, useState } from "react";

import { Chip } from "@/components/ui/chip";
import { Select, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { MapChipToggle } from "./MapChipToggle";
import { MapSearchIcon } from "./MapSearchIcon";
import { RATING_OPTIONS, type OpenValue, type RatingValue } from "./map-filters";

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
      <RatingSelect value={rating} onChange={setRating} onOpenChange={onRatingDropdownOpenChange} />
      <MapChipToggle pressed={isOpenOnly} onPressedChange={(pressed) => setOpenNow(pressed ? "open" : "all")}>
        영업 중
      </MapChipToggle>
    </div>
  );
}

function RatingSelect({
  value,
  onChange,
  onOpenChange,
}: Readonly<{
  value: RatingValue;
  onChange: (value: RatingValue) => void;
  onOpenChange?: (open: boolean) => void;
}>) {
  const [isOpen, setIsOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const isActive = value !== "all";
  const triggerLabel = isActive ? (RATING_OPTIONS.find((option) => option.value === value)?.label ?? "평점") : "평점";

  function changeOpen(open: boolean) {
    setIsOpen(open);
    onOpenChange?.(open);
  }

  useEffect(() => {
    if (!isOpen) return;
    const closeOnMove = (event: Event) => {
      if (event.target instanceof Node && popupRef.current?.contains(event.target)) return;
      setIsOpen(false);
      onOpenChange?.(false);
    };
    window.addEventListener("scroll", closeOnMove, true);
    window.addEventListener("resize", closeOnMove);
    return () => {
      window.removeEventListener("scroll", closeOnMove, true);
      window.removeEventListener("resize", closeOnMove);
    };
  }, [isOpen, onOpenChange]);

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next);
      }}
      open={isOpen}
      onOpenChange={changeOpen}
    >
      <Chip variant="outline" size="md" selected={isActive} render={<SelectPrimitive.Trigger aria-label="평점 필터" />}>
        <span>{triggerLabel}</span>
        <SelectPrimitive.Icon className="flex shrink-0 transition-transform data-popup-open:rotate-180 motion-reduce:transition-none">
          <MapSearchIcon name="chevron-down" />
        </SelectPrimitive.Icon>
      </Chip>
      <SelectContent ref={popupRef} className="w-max min-w-[136px]">
        {RATING_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
