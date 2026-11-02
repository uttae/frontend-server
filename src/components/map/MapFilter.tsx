import { Select as SelectPrimitive } from "@base-ui/react/select";
import { useEffect, useRef, useState } from "react";

import { Chip } from "@/components/ui/chip";
import { Select, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { MapChipToggle } from "./MapChipToggle";
import { MapSearchIcon } from "./MapSearchIcon";
import {
  RATING_OPTIONS,
  type OpenValue,
  type RatingValue,
} from "./map-filters";

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
      <MapChipToggle
        pressed={isOpenOnly}
        onPressedChange={(pressed) => setOpenNow(pressed ? "open" : "all")}
      >
        영업 중
      </MapChipToggle>
    </div>
  );
}

/**
 * 평점 하나를 고르는 Select. 트리거는 옆 칩들과 같은 Chip Outline md이고, 평점을 고르면 선택 칩 모양으로 그 라벨을 보인다("전체"면 "평점").
 * Select 트리거에는 aria-pressed가 없어 Chip이 선택 모양을 그리지 못하므로 selected로 준다.
 * 목록은 ui Select 모양(트리거 아래 4px, 늘 아래로)이고, 폭은 칩보다 넓게 지금 값(최소 136px)으로 라벨 폭에 맞춘다
 */
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

  // 지금 동작 유지: 열린 동안 페이지·툴바 가로 스크롤이 움직이거나 창 크기가 바뀌면 닫는다(목록 안 스크롤은 제외).
  // Base UI 목록은 닫지 않고 위치만 따라간다
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
      <Chip
        variant="outline"
        size="md"
        selected={isActive}
        render={<SelectPrimitive.Trigger aria-label="평점 필터" />}
      >
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
