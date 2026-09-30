"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { usePlacesSearch } from "@/hooks/usePlacesSearch";
import {
  clearActiveSearchMapPins,
  placeSearchResultsToMapPins,
  setActiveSearchMapPins,
} from "@/lib/active-search-map-pins";
import { bucketResultCount } from "@/lib/analytics/context";
import { AnalyticsEvents, trackAnalyticsEvent } from "@/lib/analytics/track";
import { PLACES_SEARCH_PAGE_SIZE } from "@/lib/places/placesSearchPageSize";
import { clampPlacesSearchRadiusMeters } from "@/lib/places/placesSearchRadius";
import { useMapCenterStore } from "@/stores/map-center-store";
import {
  searchPinWriteStillValid,
  useMapPinsFocusStore,
} from "@/stores/map-pins-focus-store";
import { useMobileMapSearchStore } from "@/stores/mobile-map-search-store";
import {
  useSearchRecenterStore,
  type SearchMapSnapshot,
} from "@/stores/search-recenter-store";

/**
 * 모바일 지도 텍스트 검색(엔터) — 확정한 검색어를 현재 지도 영역에서 검색해 결과 핀을 띄운다.
 * `/search` 페이지와 같은 스토어(검색 스냅샷·결과 핀·「이 지역 재검색」)를 쓴다.
 */
export function useMobileMapTextSearch() {
  const textQuery = useMobileMapSearchStore((s) => s.textQuery);
  const textSearchNonce = useMobileMapSearchStore((s) => s.textSearchNonce);
  const mapCenter = useMapCenterStore((s) => s.mapCenter);
  const zoom = useMapCenterStore((s) => s.zoom);
  const radiusMeters = useMapCenterStore((s) => s.radiusMeters);
  const searchRecenterRequestId = useSearchRecenterStore(
    (s) => s.searchRecenterRequestId,
  );

  const viewport: SearchMapSnapshot | null = mapCenter
    ? {
        center: mapCenter,
        zoom,
        radius: clampPlacesSearchRadiusMeters(
          radiusMeters != null && Number.isFinite(radiusMeters) ? radiusMeters : 5000,
        ),
      }
    : null;

  const [search, setSearch] = useState({
    query: "",
    snapshot: null as SearchMapSnapshot | null,
    generation: 0,
    nonce: textSearchNonce,
    recenterRequestId: searchRecenterRequestId,
    mode: "text" as "text" | "map_recenter",
  });
  const submitted = search.nonce !== textSearchNonce;
  const recentered = search.recenterRequestId !== searchRecenterRequestId;
  if (submitted || recentered) {
    const query = submitted ? textQuery : search.query;
    setSearch({
      query,
      snapshot: query ? viewport : null,
      generation: search.generation + 1,
      nonce: textSearchNonce,
      recenterRequestId: searchRecenterRequestId,
      mode: !submitted && recentered ? "map_recenter" : "text",
    });
  }

  const searchCoords = search.snapshot?.center ?? null;
  const searchPinsEpochRef = useRef(0);
  const lastSettledGenerationRef = useRef(0);

  // 확정한 스냅샷을 지도(재검색 버튼 판단)에 알린다
  useLayoutEffect(() => {
    const { clearSearchSnapshot, setSearchSnapshot } = useSearchRecenterStore.getState();
    clearActiveSearchMapPins();
    if (!search.snapshot) {
      clearSearchSnapshot();
      useMapPinsFocusStore.getState().releaseSearchFocusIfActive();
      return;
    }
    searchPinsEpochRef.current = useMapPinsFocusStore.getState().claimFocus("search");
    setSearchSnapshot(search.snapshot);
  }, [search.snapshot, search.generation]);

  const { items, isFetching, isError, isSuccess } = usePlacesSearch(
    search.query,
    searchCoords?.lat ?? null,
    searchCoords?.lng ?? null,
    searchCoords !== null ? search.snapshot?.radius : undefined,
    PLACES_SEARCH_PAGE_SIZE,
    search.generation,
  );

  const hasActiveSearch = search.query.length > 0 && searchCoords !== null;

  useEffect(() => {
    if (!hasActiveSearch || isFetching) return;
    if (lastSettledGenerationRef.current === search.generation) return;
    if (isError) {
      lastSettledGenerationRef.current = search.generation;
      toast.error("검색에 실패했어요. 다시 시도해주세요.");
      return;
    }
    if (!isSuccess) return;
    lastSettledGenerationRef.current = search.generation;
    trackAnalyticsEvent(AnalyticsEvents.search, {
      result_count_bucket: bucketResultCount(items.length),
      search_mode: search.mode,
    });
    if (items.length === 0) toast("이 지역에는 검색 결과가 없어요.");
  }, [
    hasActiveSearch,
    isError,
    isFetching,
    isSuccess,
    items.length,
    search.generation,
    search.mode,
  ]);

  useEffect(() => {
    if (!hasActiveSearch || isFetching || isError) {
      clearActiveSearchMapPins();
      return;
    }
    if (!searchPinWriteStillValid(searchPinsEpochRef.current)) return;
    setActiveSearchMapPins(placeSearchResultsToMapPins(items));
  }, [hasActiveSearch, isFetching, isError, items]);

  // 지도 화면을 떠나면 검색 핀·스냅샷·검색어를 정리한다
  useEffect(
    () => () => {
      clearActiveSearchMapPins();
      useMapPinsFocusStore.getState().releaseSearchFocusIfActive();
      useSearchRecenterStore.getState().clearSearchSnapshot();
      useMobileMapSearchStore.setState({ textQuery: "" });
    },
    [],
  );

  return { isSearching: hasActiveSearch && isFetching };
}
