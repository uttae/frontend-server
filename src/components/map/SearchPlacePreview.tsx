"use client";

import { ArrowRight, Star, X } from "lucide-react";
import type { PlaceSearchResult } from "@/hooks/usePlacesSearch";

/** Text Search 응답만 표시한다. 상세 조회는 화살표를 누른 뒤 기존 패널이 담당한다. */
export function SearchPlacePreview({ place, onOpenDetail, onClose }: {
  place: PlaceSearchResult;
  onOpenDetail: () => void;
  onClose: () => void;
}) {
  return (
    <div data-search-place-preview className="w-[264px] max-w-full p-3 font-sans text-text">
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 text-body-m-emphasis break-words">{place.name}</h3>
        <button type="button" onClick={onClose} aria-label="미리보기 닫기"
          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-icon-subtle hover:bg-fill focus-visible:outline-2 focus-visible:outline-primary">
          <X size={18} aria-hidden />
        </button>
      </div>
      {place.category ? <p className="mt-1 text-caption-m-regular text-text-subtle">{place.category}</p> : null}
      {place.rating != null ? (
        <div className="mt-2 flex items-center gap-1 text-caption-m-regular">
          <Star size={14} aria-hidden className="fill-amber-400 text-amber-400" />
          <span className="font-semibold">{place.rating.toFixed(1)}</span>
          {place.userRatingCount != null ? <span className="text-text-subtle">({place.userRatingCount.toLocaleString()}개)</span> : null}
        </div>
      ) : null}
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-caption-m-regular text-text-subtle">
          {place.isOpen == null ? "" : place.isOpen ? "영업 중" : "영업 종료"}
        </span>
        <button type="button" onClick={onOpenDetail} aria-label={`${place.name} 상세정보 보기`}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-text-inverse hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <ArrowRight size={18} aria-hidden />
        </button>
      </div>
    </div>
  );
}
