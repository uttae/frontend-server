"use client";

import { useState } from "react";
import { SearchHereFloatingButton } from "@/components/map/SearchHereFloatingButton";
import { usePlacesSearchHereVisible } from "@/components/map/usePlacesSearchHereVisible";
import { Chip, ChipRemove } from "@/components/ui/chip";
import { usePlaceSearchStore } from "@/stores/place-search-store";
import { useSearchRecenterStore } from "@/stores/search-recenter-store";

export type MapSearchHereButtonProps = {
  discoverCategoryId: string | null;
};

export function MapSearchHereButton({
  discoverCategoryId,
}: MapSearchHereButtonProps) {
  const requestSearchRecenter = useSearchRecenterStore(
    (s) => s.requestSearchRecenter,
  );
  const requestDiscoverRecenter = useSearchRecenterStore(
    (s) => s.requestDiscoverRecenter,
  );
  const generation = usePlaceSearchStore((s) => s.generation);
  // 닫은 「검색 결과가 없어요」는 그 검색 동안만 닫혀 있다(새 검색은 generation이 바뀐다)
  const [closedGeneration, setClosedGeneration] = useState<number | null>(null);
  const {
    visible,
    suggestSearchRecenter,
    searchRecenterNotice,
    suggestDiscoverRecenter,
  } = usePlacesSearchHereVisible({ discoverCategoryId });
  const showEmptyNotice =
    searchRecenterNotice === "empty" && closedGeneration !== generation;

  if (!visible && !showEmptyNotice) return null;

  return (
    <div className="pointer-events-none absolute bottom-6 left-1/2 z-[17] -translate-x-1/2">
      {showEmptyNotice ? (
        // 그림자는 지도 위 검색 열기 버튼과 같은 값(그림자 토큰 없음)
        <div role="status" className="pointer-events-auto rounded-full shadow-[0_2px_10px_#0000001a]">
          <Chip variant="outline" size="md">
            검색 결과가 없어요
            <ChipRemove aria-label="안내 닫기" onClick={() => setClosedGeneration(generation)} />
          </Chip>
        </div>
      ) : (
        <SearchHereFloatingButton
          label={searchRecenterNotice === "failed" ? "다시 시도" : "현 위치에서 검색"}
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
