"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2, Search, Send } from "lucide-react";
import { toast } from "sonner";

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
import { useChatActions } from "@/hooks/useChatActions";
import { useChat } from "@/hooks/useChat";
import {
  chatPlaceShareBannerGlowDurationSec,
  chatPlaceShareBannerSweepDurationSec,
} from "@/components/chat/chat-animations";
import { bucketResultCount, bucketSearchRank } from "@/lib/analytics/context";
import { AnalyticsEvents, trackAnalyticsEvent } from "@/lib/analytics/track";
import { useSessionStore } from "@/stores/session-store";
import {
  searchPinWriteStillValid,
  useMapPinsFocusStore,
} from "@/stores/map-pins-focus-store";

export default function SearchPage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const searchParams = useSearchParams();
  const qParam = searchParams.get("q")?.trim() ?? "";
  const isShareMode = searchParams.get("share") === "chat";
  const currentRoomId = useSessionStore((s) => s.currentRoomId);
  const hasRoom =
    typeof currentRoomId === "string" && currentRoomId.trim().length > 0;

  const { setSelectedPlace } = useSelectedPlace();
  const mapCenter = useMapCenterStore((s) => s.mapCenter);
  const searchRecenterRequestId = useSearchRecenterStore(
    (s) => s.searchRecenterRequestId,
  );
  const { sendPlaceMessage, canSend } = useChatActions();
  const { openChat } = useChat();

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

  const shareModeActive = isShareMode && hasRoom;

  function handleCardClick(result: PlaceSearchResult, index: number) {
    if (shareModeActive) {
      if (!canSend) {
        toast.error("채팅 연결을 확인해주세요.");
        return;
      }
      sendPlaceMessage({
        googlePlaceId: result.googlePlaceId,
        name: result.name,
        formattedAddress: result.address ?? "",
        latitude: result.location.lat,
        longitude: result.location.lng,
        rating: result.rating ?? 0,
      });
      toast.success("장소를 채팅으로 보냈어요");
      router.replace("/search");
      openChat();
      return;
    }
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
      {shareModeActive ? (
        <motion.div
          className="relative shrink-0 overflow-hidden border-b border-primary/40"
          initial={reduceMotion ? false : { opacity: 0, y: -6 }}
          animate={
            reduceMotion
              ? {
                  opacity: 1,
                  y: 0,
                  backgroundColor: "rgba(241,45,51,0.09)",
                }
              : {
                  opacity: 1,
                  y: 0,
                  backgroundColor: [
                    "rgba(241,45,51,0.055)",
                    "rgba(241,45,51,0.13)",
                    "rgba(241,45,51,0.055)",
                  ],
                  boxShadow: [
                    "inset 0 0 0 rgba(241,45,51,0)",
                    "inset 0 -18px 40px rgba(241,45,51,0.125)",
                    "inset 0 0 0 rgba(241,45,51,0)",
                  ],
                }
          }
          transition={
            reduceMotion
              ? { duration: 0 }
              : {
                  opacity: { type: "spring", stiffness: 420, damping: 32 },
                  y: { type: "spring", stiffness: 420, damping: 32 },
                  backgroundColor: {
                    repeat: Infinity,
                    duration: chatPlaceShareBannerGlowDurationSec,
                    ease: "easeInOut",
                  },
                  boxShadow: {
                    repeat: Infinity,
                    duration: chatPlaceShareBannerGlowDurationSec,
                    ease: "easeInOut",
                  },
                }
          }
        >
          {!reduceMotion ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-[11px] overflow-hidden bg-gradient-to-b from-primary/[0.38] via-primary/[0.12] to-transparent"
            >
              <motion.div
                className="absolute left-0 top-px h-[3px] w-[44%]"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 5%, rgba(251,165,173,1) 38%, rgba(255,248,249,1) 48%, rgba(241,45,51,1) 52%, rgba(255,190,196,1) 60%, transparent 95%)",
                  boxShadow:
                    "0 0 18px rgba(241,45,51,1), 0 0 32px rgba(241,45,51,0.65), 0 0 48px rgba(255,96,109,0.45)",
                  filter: "blur(0.55px)",
                }}
                initial={false}
                animate={{ left: ["-48%", "135%"] }}
                transition={{
                  repeat: Infinity,
                  duration: chatPlaceShareBannerSweepDurationSec,
                  ease: "linear",
                }}
              />
            </div>
          ) : null}
          <div className="relative z-[3] flex min-h-13 shrink-0 items-center gap-2 px-4 py-3 text-base font-semibold leading-snug tracking-tight text-primary drop-shadow-[0_0_10px_rgba(241,45,51,0.22)]">
            <motion.span
              className="inline-flex shrink-0 text-primary"
              aria-hidden
              animate={
                reduceMotion
                  ? {}
                  : {
                      filter: [
                        "drop-shadow(0 0 2px rgba(241,45,51,0.25))",
                        "drop-shadow(0 0 7px rgba(241,45,51,0.55))",
                        "drop-shadow(0 0 2px rgba(241,45,51,0.25))",
                      ],
                    }
              }
              transition={{
                repeat: Infinity,
                duration: chatPlaceShareBannerGlowDurationSec,
                ease: "easeInOut",
              }}
            >
              <Send className="h-4 w-4" />
            </motion.span>
            <span className="min-w-0 flex-1">
              장소를 선택하면 채팅으로 전송됩니다.
            </span>
            <button
              type="button"
              onClick={() => router.replace("/search")}
              className="ml-auto shrink-0 cursor-pointer rounded-md border border-primary/45 bg-white/92 px-2.5 py-1.5 text-[13px] font-medium text-dark-gray shadow-sm hover:bg-white"
            >
              취소
            </button>
          </div>
        </motion.div>
      ) : null}

      {/* 결과 */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {showSearchLoading && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-dark-gray">
            <Loader2 className="h-6 w-6 animate-spin text-primary-strong" />
            <span className="text-[17px]">장소를 검색하는 중...</span>
          </div>
        )}

        {hasActiveSearch && isError && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-[#FF6467]">
            <AlertCircle className="h-6 w-6" />
            <span className="text-[17px]">
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
              <span className="text-[17px]">검색 결과가 없습니다.</span>
            </div>
          )}

        {!hasActiveSearch && (
          <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-1 text-[#99A1AF]">
            <Search className="h-8 w-8" />
            <span className="text-[17px]">검색어를 입력해 주세요.</span>
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
