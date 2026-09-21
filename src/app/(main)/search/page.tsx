"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2, Search } from "lucide-react";

import { SearchResultCard } from "@/components/place";
import { SetSectionMaxWidth } from "@/contexts/SectionWidthContext";
import { MainPageHeader } from "@/components/layout/MainPageHeader";
import { useSelectedPlace } from "@/contexts/SelectedPlaceContext";
import { clampPlacesSearchRadiusMeters } from "@/lib/places/placesSearchRadius";
import type { SearchMapSnapshot } from "@/stores/search-recenter-store";
import {
  clearActiveSearchMapPins,
  placeSearchResultsToMapPins,
  setActiveSearchMapPins,
} from "@/lib/active-search-map-pins";
import { useMapCenterStore } from "@/stores/map-center-store";
import { useSearchRecenterStore } from "@/stores/search-recenter-store";
import {
  usePlacesSearch,
  type PlaceSearchResult,
} from "@/hooks/usePlacesSearch";
import { PLACES_SEARCH_PAGE_SIZE } from "@/lib/places/placesSearchPageSize";
import { PlacesSearchInput } from "@/components/search/PlacesSearchInput";
import { PlacesSearchPagination } from "@/components/search/PlacesSearchPagination";
import { bucketResultCount, bucketSearchRank } from "@/lib/analytics/context";
import { AnalyticsEvents, trackAnalyticsEvent } from "@/lib/analytics/track";
import {
  searchPinWriteStillValid,
  useMapPinsFocusStore,
} from "@/stores/map-pins-focus-store";

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qParam = searchParams.get("q")?.trim() ?? "";

  const { setSelectedPlace } = useSelectedPlace();
  const mapCenter = useMapCenterStore((s) => s.mapCenter);
  const searchRecenterRequestId = useSearchRecenterStore(
    (s) => s.searchRecenterRequestId,
  );

  const zoom = useMapCenterStore((s) => s.zoom);
  const radiusMeters = useMapCenterStore((s) => s.radiusMeters);
  const viewport: SearchMapSnapshot | null = mapCenter ? {
    center: mapCenter,
    zoom,
    radius: clampPlacesSearchRadiusMeters(
      radiusMeters != null && Number.isFinite(radiusMeters) ? radiusMeters : 5000,
    ),
  } : null;
  const [search, setSearch] = useState({
    query: qParam,
    snapshot: qParam ? viewport : null,
    generation: qParam && viewport ? 1 : 0,
    recenterRequestId: searchRecenterRequestId,
    mode: "text" as "text" | "map_recenter",
  });
  const urlChanged = search.query !== qParam;
  const recentered = search.recenterRequestId !== searchRecenterRequestId;
  if (urlChanged || recentered || (qParam && !search.snapshot && viewport)) {
    setSearch({
      query: qParam,
      snapshot: qParam ? viewport : null,
      generation: search.generation + 1,
      recenterRequestId: searchRecenterRequestId,
      mode: !urlChanged && recentered ? "map_recenter" : "text",
    });
  }
  const query = search.query;
  const searchCoords = search.snapshot?.center ?? null;
  const searchRadius = search.snapshot?.radius;
  const searchGeneration = search.generation;
  const lastTrackedSearchGenerationRef = useRef(0);
  const searchPinsEpochRef = useRef(0);

  // Publish the committed snapshot to the map; state ownership stays in this render.
  useLayoutEffect(() => {
    const { clearSearchSnapshot, setSearchSnapshot } = useSearchRecenterStore.getState();
    clearActiveSearchMapPins();
    if (!search.snapshot) {
      clearSearchSnapshot();
      return;
    }
    searchPinsEpochRef.current = useMapPinsFocusStore.getState().claimFocus("search");
    setSearchSnapshot(search.snapshot);
  }, [search.snapshot, search.generation]);

  function handleSearch(q: string) {
    const trimmed = q.trim();
    if (trimmed === qParam) {
      setSearch({
        query: trimmed,
        snapshot: trimmed ? viewport : null,
        generation: search.generation + 1,
        recenterRequestId: searchRecenterRequestId,
        mode: "text",
      });
    }
    const params = new URLSearchParams(searchParams.toString());
    if (trimmed) params.set("q", trimmed);
    else params.delete("q");
    router.replace(`/search?${params.toString()}`, { scroll: false });
  }

  const {
    items,
    pageIndex,
    hasPreviousPage,
    hasNextPage,
    goToPreviousPage,
    goToNextPage,
    isFetching,
    isError,
    isSuccess,
    error,
  } = usePlacesSearch(
    query,
    searchCoords?.lat ?? null,
    searchCoords?.lng ?? null,
    searchCoords !== null ? searchRadius : undefined,
    PLACES_SEARCH_PAGE_SIZE,
    searchGeneration,
  );

  useEffect(() => {
    if (searchGeneration === 0 || !isSuccess || isFetching) return;
    if (lastTrackedSearchGenerationRef.current === searchGeneration) return;
    if (!query.trim() || searchCoords === null) return;

    lastTrackedSearchGenerationRef.current = searchGeneration;
    trackAnalyticsEvent(AnalyticsEvents.search, {
      result_count_bucket: bucketResultCount(items.length),
      search_mode: search.mode,
    });
  }, [
    isFetching,
    isSuccess,
    items.length,
    query,
    searchCoords,
    searchGeneration,
    search.mode,
  ]);

  const hasActiveSearch = query.trim().length > 0 && searchCoords !== null;
  const showResultList =
    hasActiveSearch && isSuccess && !isError && items.length > 0;

  const resultsScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    resultsScrollRef.current?.scrollTo({ top: 0 });
  }, [pageIndex]);
  const showPagination =
    hasActiveSearch &&
    isSuccess &&
    !isError &&
    (items.length > 0 || pageIndex > 0);

  const showSearchLoading =
    hasActiveSearch && isFetching && items.length === 0;

  useEffect(() => {
    if (!hasActiveSearch) {
      clearActiveSearchMapPins();
      useMapPinsFocusStore.getState().releaseSearchFocusIfActive();
      return;
    }

    if (isFetching) {
      clearActiveSearchMapPins();
      return;
    }

    if (isError) {
      clearActiveSearchMapPins();
      return;
    }

    if (!searchPinWriteStillValid(searchPinsEpochRef.current)) return;
    setActiveSearchMapPins(placeSearchResultsToMapPins(items));
  }, [hasActiveSearch, isFetching, isError, items]);

  useEffect(
    () => () => {
      clearActiveSearchMapPins();
      useMapPinsFocusStore.getState().releaseSearchFocusIfActive();
      useSearchRecenterStore.getState().clearSearchSnapshot();
    },
    [],
  );

  function handleCardClick(result: PlaceSearchResult, index: number) {
    setSelectedPlace(result, {
      analyticsRankBucket: bucketSearchRank(
        pageIndex * PLACES_SEARCH_PAGE_SIZE + index,
      ),
      preserveMapZoom: true,
      itinerarySource: "search",
    });
  }

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col border-b border-gray-border">
      <SetSectionMaxWidth value="s1" />

      <MainPageHeader className="shrink-0 px-6 pb-4" title="장소 검색" />

      {/* 검색 입력 — focus ring이 잘리지 않도록 상·좌우 여백 */}
      <div className="shrink-0 overflow-visible pl-6 pr-3 pb-2.5 border-b border-gray-border">
        <PlacesSearchInput
          coords={mapCenter}
          urlQuery={qParam}
          onSearch={handleSearch}
          onClear={() => handleSearch("")}
        />
      </div>

      {/* 결과 */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {showSearchLoading && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-dark-gray">
            <Loader2 className="h-6 w-6 animate-spin text-primary-strong" />
            <span className="text-body-m-regular mobile:text-body-s-regular">장소를 검색하는 중...</span>
          </div>
        )}

        {hasActiveSearch && isError && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-[#FF6467]">
            <AlertCircle className="h-6 w-6" />
            <span className="text-body-m-regular mobile:text-body-s-regular">
              {error instanceof Error ? error.message : "검색에 실패했습니다."}
            </span>
          </div>
        )}

        {hasActiveSearch &&
          isSuccess &&
          !isError &&
          items.length === 0 &&
          pageIndex === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-1 text-dark-gray">
              <Search className="h-6 w-6 text-[#99A1AF]" />
              <span className="text-body-m-regular mobile:text-body-s-regular">검색 결과가 없습니다.</span>
            </div>
          )}

        {!hasActiveSearch && (
          <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-1 text-[#99A1AF]">
            <Search className="h-8 w-8" />
            <span className="text-body-m-regular mobile:text-body-s-regular">검색어를 입력해 주세요.</span>
          </div>
        )}

        {showResultList && (
          <div
            ref={resultsScrollRef}
            className="relative min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-color:rgba(0,0,0,0.2)_transparent]"
          >
            <ul className="w-full min-w-0">
              {items.map((result, index) => (
                <li key={result.googlePlaceId} className="w-full">
                  <SearchResultCard
                    {...result}
                    variant="list"
                    showThumbnail={false}
                    className="box-border min-h-[112px] w-full shrink-0"
                    onClick={() => handleCardClick(result, index)}
                  />
                </li>
              ))}
            </ul>
            {showPagination ? (
              <PlacesSearchPagination
                hasPrevious={hasPreviousPage}
                hasNext={hasNextPage}
                pageLabel={`${pageIndex + 1}페이지`}
                onPrevious={goToPreviousPage}
                onNext={goToNextPage}
                disabled={isFetching}
              />
            ) : null}
            {isFetching && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/50">
                <Loader2 className="h-6 w-6 animate-spin text-primary-strong" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
