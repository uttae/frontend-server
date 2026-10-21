"use client";

import type { PlaceSearchResult } from "@/hooks/usePlacesSearch";
import { MapSearchIcon } from "./MapSearchIcon";

/** Preview uses available result data; only the arrow opens the existing detail panel. */
export function SearchPlacePreview({ place, onOpenDetail, onClose }: Readonly<{
  place: PlaceSearchResult;
  onOpenDetail: () => void;
  onClose: () => void;
}>) {
  const openingStatus = place.isOpen == null ? null : place.isOpen ? "영업 중" : "영업 종료";
  return (
    <div data-search-place-preview className="w-[260px] max-w-full rounded-lg bg-fill-subtle px-4 pb-4 pt-3.5 font-sans text-text">
      <div className="flex items-start justify-between">
        <h3 title={place.name} className="min-w-0 flex-1 truncate text-title-s">{place.name}</h3>
        <button type="button" onClick={onClose} aria-label="미리보기 닫기"
          className="flex size-[26px] shrink-0 cursor-pointer items-start justify-end rounded hover:bg-fill focus-visible:outline-2 focus-visible:outline-primary">
          <MapSearchIcon name="close"/>
        </button>
      </div>
      <div className="flex items-end gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {place.category || openingStatus ? (
            <p className="truncate text-caption-l-regular text-text-subtle">
              {[place.category, openingStatus].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          {place.rating != null ? (
            <div className="flex items-center gap-px text-caption-l-regular">
              <MapSearchIcon name="star"/>
              <span className="text-caption-l-emphasis">{place.rating.toFixed(1)}</span>
              {place.userRatingCount != null ? <span className="ml-px text-text-subtle">({place.userRatingCount.toLocaleString()}개)</span> : null}
            </div>
          ) : null}
        </div>
        <div className="flex size-11 shrink-0 items-end justify-end">
          <button type="button" onClick={onOpenDetail} aria-label={`${place.name} 상세정보 보기`}
            className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-primary shadow-[0_2px_10px_#0000001a] hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <MapSearchIcon name="arrow-right"/>
          </button>
        </div>
      </div>
    </div>
  );
}
