"use client";

import { shouldSuggestPlacesSearchRecenter } from "@/lib/maps";
import { useMapCenterStore } from "@/stores/map-center-store";
import { usePlaceSearchStore } from "@/stores/place-search-store";
import type { DiscoverMapSnapshot } from "@/stores/search-recenter-store";
import { useSearchRecenterStore } from "@/stores/search-recenter-store";
import type { MapCenterCoords } from "@/stores/map-center-store";

type UsePlacesSearchHereVisibleParams = {
  discoverCategoryId: string | null;
  /** 카테고리 검색(MapDiscoverPlaces)이 실패함 */
  discoverFailed: boolean;
};

/** 「현 위치에서 검색」 결과를 버튼 자리에서 알린다: 실패는 「다시 시도」, 결과 0개는 「검색 결과가 없어요」 */
export type SearchRecenterNotice = "failed" | "empty";

export type PlacesSearchHereVisibility = {
  visible: boolean;
  suggestSearchRecenter: boolean;
  searchRecenterNotice: SearchRecenterNotice | null;
  suggestDiscoverRecenter: boolean;
  /** 실패한 카테고리 검색을 같은 화면에서 다시 시도 */
  retryDiscoverRecenter: boolean;
};

function searchRecenterNoticeOf(
  status: "idle" | "pending" | "done" | "error",
  hasResults: boolean,
): SearchRecenterNotice | null {
  if (status === "error") return "failed";
  if (status === "done" && !hasResults) return "empty";
  return null;
}

function chipsDiscoverRecenterEligible(
  discoverCategoryId: string | null,
  discoverSnapshot: DiscoverMapSnapshot | null,
  mapCenter: MapCenterCoords,
  zoom: number | null,
): boolean {
  const chipChosen =
    typeof discoverCategoryId === "string"
    && discoverCategoryId.trim().length > 0;

  /** 칩 미선택이면 디스커버 재센터 없음 — 텍스트 검색은 별도 */
  if (!chipChosen || discoverSnapshot == null) return false;

  return shouldSuggestPlacesSearchRecenter({
    mapCenter,
    snapshotCenter: discoverSnapshot.center,
    snapshotRadiusMeters: discoverSnapshot.radius,
    zoom,
    snapshotZoom: discoverSnapshot.zoom,
  });
}

/**
 * 맵 하단 「이 위치 검색」 표시 여부:
 * - 텍스트 검색: `searchSnapshot`만 필요(칩과 무관)
 * - 카테고리 디스커버: 칩 선택 + 디스커버 스냅샷 + 카메라 이탈 시에만
 */
export function usePlacesSearchHereVisible({
  discoverCategoryId,
  discoverFailed,
}: UsePlacesSearchHereVisibleParams): PlacesSearchHereVisibility {
  const mapCenter = useMapCenterStore((s) => s.mapCenter);
  const zoom = useMapCenterStore((s) => s.zoom);
  const searchSnapshot = useSearchRecenterStore((s) => s.searchSnapshot);
  const discoverSnapshot = useSearchRecenterStore((s) => s.discoverSnapshot);
  const searchMode = usePlaceSearchStore((s) => s.searchMode);
  const searchStatus = usePlaceSearchStore((s) => s.status);
  const hasResults = usePlaceSearchStore((s) => s.items.length > 0);

  if (!mapCenter) {
    return {
      visible: false,
      suggestSearchRecenter: false,
      searchRecenterNotice: null,
      suggestDiscoverRecenter: false,
      retryDiscoverRecenter: false,
    };
  }

  const movedFromSearch =
    searchSnapshot != null
    && shouldSuggestPlacesSearchRecenter({
      mapCenter,
      snapshotCenter: searchSnapshot.center,
      snapshotRadiusMeters: searchSnapshot.radius,
      zoom,
      snapshotZoom: searchSnapshot.zoom,
    });
  // 실패·결과 없음은 검색한 그 화면에서만 알린다. 지도를 옮기면 새 화면 검색이라 「현 위치에서 검색」으로 돌아간다
  const searchRecenterNotice =
    movedFromSearch || searchMode !== "map_recenter"
      ? null
      : searchRecenterNoticeOf(searchStatus, hasResults);
  const suggestSearchRecenter =
    movedFromSearch || searchRecenterNotice === "failed";

  const movedFromDiscover = chipsDiscoverRecenterEligible(
    discoverCategoryId,
    discoverSnapshot,
    mapCenter,
    zoom,
  );
  // 카테고리 검색이 실패하면 그 화면에서 「다시 시도」, 지도를 옮기면 새 화면 검색이라 「현 위치에서 검색」
  const retryDiscoverRecenter =
    discoverFailed && discoverSnapshot != null && !movedFromDiscover;
  const suggestDiscoverRecenter = movedFromDiscover || retryDiscoverRecenter;

  return {
    visible: suggestSearchRecenter || suggestDiscoverRecenter,
    suggestSearchRecenter,
    searchRecenterNotice,
    suggestDiscoverRecenter,
    retryDiscoverRecenter,
  };
}
