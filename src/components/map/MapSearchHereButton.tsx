"use client";

import { useState } from "react";
import { CloseIcon } from "@/assets/icons";
import {
  SearchHereFloatingButton,
  searchHerePillClass,
} from "@/components/map/SearchHereFloatingButton";
import { usePlacesSearchHereVisible } from "@/components/map/usePlacesSearchHereVisible";
import { cn } from "@/lib/utils";
import { usePlaceSearchStore } from "@/stores/place-search-store";
import { useSearchRecenterStore } from "@/stores/search-recenter-store";

export type MapSearchHereButtonProps = {
  discoverCategoryId: string | null;
  discoverFailed: boolean;
};

export function MapSearchHereButton({
  discoverCategoryId,
  discoverFailed,
}: MapSearchHereButtonProps) {
  const requestSearchRecenter = useSearchRecenterStore(
    (s) => s.requestSearchRecenter,
  );
  const requestDiscoverRecenter = useSearchRecenterStore(
    (s) => s.requestDiscoverRecenter,
  );
  const generation = usePlaceSearchStore((s) => s.generation);
  const [closedGeneration, setClosedGeneration] = useState<number | null>(null);
  const {
    visible,
    suggestSearchRecenter,
    searchRecenterNotice,
    suggestDiscoverRecenter,
    retryDiscoverRecenter,
  } = usePlacesSearchHereVisible({ discoverCategoryId, discoverFailed });
  const showEmptyNotice =
    searchRecenterNotice === "empty" && closedGeneration !== generation;

  if (!visible && !showEmptyNotice) return null;

  return (
    <div className="pointer-events-none absolute bottom-6 left-1/2 z-[17] -translate-x-1/2">
      {showEmptyNotice ? (
        <div role="status" className={cn(searchHerePillClass, "pe-1")}>
          검색 결과가 없어요
          <button
            type="button"
            aria-label="안내 닫기"
            onClick={() => setClosedGeneration(generation)}
            className="-my-3 grid h-11 w-8 shrink-0 cursor-pointer place-items-center text-primary focus-visible:outline-2 focus-visible:outline-primary"
          >
            <CloseIcon size={16} />
          </button>
        </div>
      ) : (
        <SearchHereFloatingButton
          label={
            searchRecenterNotice === "failed" || retryDiscoverRecenter
              ? "다시 시도"
              : "현 위치에서 검색"
          }
          onPress={() => {
            if (suggestSearchRecenter) {
              requestSearchRecenter();
              return;
            }
            if (suggestDiscoverRecenter) {
              requestDiscoverRecenter();
            }
          }}
        />
      )}
    </div>
  );
}
