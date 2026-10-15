"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { useSelectedPlace } from "@/contexts/SelectedPlaceContext";
import { useSessionUser } from "@/hooks/useSessionUser";
import {
  fetchPlacesPageWithPhotos,
  type PlaceSearchResult,
} from "@/hooks/usePlacesSearch";
import {
  clearActiveSearchMapPins,
  placeSearchResultsToMapPins,
  setActiveSearchMapPins,
} from "@/lib/active-search-map-pins";
import {
  bucketResultCount,
  bucketSearchRank,
  type SearchRankBucket,
} from "@/lib/analytics/context";
import { AnalyticsEvents, trackAnalyticsEvent } from "@/lib/analytics/track";
import { getQueryClient } from "@/lib/query-client";
import { placeDetailQueryKey } from "@/lib/places/place-queries";
import { PLACES_SEARCH_PAGE_SIZE } from "@/lib/places/placesSearchPageSize";
import {
  confirmPlaceSearch,
  type ResolvedSearchAnchor,
  type SearchConfirmation,
} from "@/lib/places/search-session";
import { useMapCenterStore } from "@/stores/map-center-store";
import {
  searchPinWriteStillValid,
  useMapPinsFocusStore,
} from "@/stores/map-pins-focus-store";
import { useMobileMapSearchStore } from "@/stores/mobile-map-search-store";
import { usePlaceSearchStore } from "@/stores/place-search-store";
import { useSearchRecenterStore } from "@/stores/search-recenter-store";
import { useSessionStore } from "@/stores/session-store";

export function useMapPlaceSearch(mobile: boolean) {
  const roomId = useSessionStore((s) => s.currentRoomId);
  const userId = useSessionUser().data?.id;
  const scopeKey = `${userId ?? "anonymous"}:${roomId ?? "no-room"}`;
  const { selectedPlace, setSelectedPlace, analyticsRankPending } =
    useSelectedPlace();
  const pinsFocus = useMapPinsFocusStore((s) => s.focus);
  const recenterId = useSearchRecenterStore((s) => s.searchRecenterRequestId);
  const legacyQuery = useMobileMapSearchStore((s) => s.textQuery);
  const legacyNonce = useMobileMapSearchStore((s) => s.textSearchNonce);
  const seenLegacyNonce = useRef(legacyNonce);
  const seenRecenter = useRef(recenterId);

  useEffect(() => {
    if (usePlaceSearchStore.getState().scope !== scopeKey) {
      usePlaceSearchStore.getState().setScope(scopeKey);
      clearActiveSearchMapPins();
      useSearchRecenterStore.getState().clearSearchSnapshot();
      setSelectedPlace(null);
    }
  }, [scopeKey, setSelectedPlace]);

  function invalidate(clear: boolean) {
    if (clear) {
      usePlaceSearchStore.getState().clear();
      clearActiveSearchMapPins();
      useSearchRecenterStore.getState().clearSearchSnapshot();
      useMapPinsFocusStore.getState().releaseSearchFocusIfActive();
      setSelectedPlace(null);
    } else {
      const selectedId = usePlaceSearchStore.getState().selectedId;
      // Keep complete visible data, but unmount an unfinished detail selection so its late
      // request can populate the public cache without changing the edited search UI.
      if (
        selectedId &&
        !getQueryClient()?.getQueryData(placeDetailQueryKey(selectedId))
      )
        setSelectedPlace(null);
      else if (analyticsRankPending && selectedPlace)
        setSelectedPlace(selectedPlace, {
          itinerarySource: "search",
          analyticsSource: "search",
          skipMapRecenter: true,
        });
      usePlaceSearchStore.getState().invalidate();
    }
  }

  const settleOwnershipLoss = useEffectEvent(() => {
    if (usePlaceSearchStore.getState().status === "pending") invalidate(false);
  });
  useEffect(() => {
    if (pinsFocus !== "search") settleOwnershipLoss();
  }, [pinsFocus]);

  async function confirm(
    confirmation: SearchConfirmation,
    mode: "text" | "map_recenter" = "text",
  ): Promise<boolean> {
    const query = confirmation.query.trim();
    if (!query) return false;
    const state = usePlaceSearchStore.getState();
    const generation = state.invalidate();
    const epoch = useMapPinsFocusStore.getState().claimFocus("search");
    const isCurrent = () =>
      usePlaceSearchStore.getState().generation === generation &&
      usePlaceSearchStore.getState().scope === scopeKey &&
      useSessionStore.getState().currentRoomId === roomId &&
      searchPinWriteStillValid(epoch);
    const mapCenter = useMapCenterStore.getState().mapCenter;
    usePlaceSearchStore.setState({
      query,
      confirmationKind: confirmation.kind,
      status: "pending",
      error: null,
      expanded: false,
      termination: "not-requested",
      resolution: null,
    });
    setSelectedPlace(null);
    if (!mobile) usePlaceSearchStore.setState({ selectedId: null });
    if (mobile) {
      useMobileMapSearchStore.setState({ textQuery: query });
    }
    const toAnchor = (anchor: ResolvedSearchAnchor): PlaceSearchResult => ({
      googlePlaceId: anchor.googlePlaceId,
      name:
        anchor.detail.name ??
        confirmation.prediction?.structuredFormat?.mainText?.text ??
        confirmation.prediction?.text?.text ?? "",
      address: anchor.detail.formattedAddress ?? "",
      category: anchor.detail.primaryTypeDisplayName ?? anchor.detail.primaryType ?? "",
      rating: anchor.detail.rating,
      userRatingCount: anchor.detail.userRatingCount,
      isOpen: anchor.detail.regularOpeningHours?.openNow ?? null,
      location: anchor.location,
    });
    try {
      const result = await confirmPlaceSearch({
        ...confirmation,
        mapCenter,
        isCurrent,
        onResolved: (resolved) => {
          usePlaceSearchStore.setState({
            termination: resolved.termination,
            resolution: {
              source: resolved.source,
              cacheStatus: resolved.cacheStatus,
              googleDetailsRequested: resolved.googleDetailsRequested,
              termination: resolved.termination,
            },
          });
        },
        search: async (params) => {
          useSearchRecenterStore.getState().setSearchSnapshot({
            center: { lat: params.latitude, lng: params.longitude },
            zoom: useMapCenterStore.getState().zoom,
            radius: params.radius,
          });
          const page = await fetchPlacesPageWithPhotos({
            ...params,
            pageSize: PLACES_SEARCH_PAGE_SIZE,
            pageToken: undefined,
          });
          return page.items;
        },
      });
      if (!result || !isCurrent()) return false;
      const searchRankBuckets: Record<string, SearchRankBucket> =
        confirmation.kind === "whole"
          ? Object.fromEntries(
              result.items.map((item, index) => [
                item.googlePlaceId,
                bucketSearchRank(index),
              ]),
            )
          : {};
      let items = result.items;
      if (confirmation.kind === "specific" && result.anchor) {
        items = [toAnchor(result.anchor)];
        useSearchRecenterStore.getState().clearSearchSnapshot();
      }
      const selectedId = mobile || confirmation.kind === "specific"
        ? (items[0]?.googlePlaceId ?? null)
        : null;
      usePlaceSearchStore.setState({
        items,
        searchRankBuckets,
        selectedId,
        status: "done",
        fallback: result.fallback,
        termination: result.termination,
      });
      setActiveSearchMapPins(placeSearchResultsToMapPins(items));
      if (confirmation.kind === "specific") {
        const selected = result.anchor
          ? (items.find(
              (item) => item.googlePlaceId === result.anchor!.googlePlaceId,
            ) ?? toAnchor(result.anchor))
          : (items[0] ?? null);
        setSelectedPlace(selected, {
          itinerarySource: "search",
          analyticsSource: "search",
          analyticsRankBucket: selected
            ? searchRankBuckets[selected.googlePlaceId]
            : undefined,
        });
      }
      if (confirmation.kind === "whole") {
        trackAnalyticsEvent(AnalyticsEvents.search, {
          result_count_bucket: bucketResultCount(result.items.length),
          search_mode: mode,
          ...(roomId ? { room_id: roomId } : {}),
        });
      }
      return true;
    } catch (error) {
      if (!isCurrent()) return false;
      usePlaceSearchStore.setState({
        status: "error",
        termination:
          usePlaceSearchStore.getState().termination === "SUCCEEDED"
            ? "SUCCEEDED"
            : usePlaceSearchStore.getState().termination === "NOT_TERMINATED"
              ? "NOT_TERMINATED"
              : confirmation.prediction
                ? "failed"
                : "not-requested",
        error:
          error instanceof Error
            ? error.message
            : "검색에 실패했어요. 다시 시도해주세요.",
      });
      return false;
    }
  }
  const recenter = useEffectEvent(() => {
    const query = usePlaceSearchStore.getState().query;
    if (query)
      void confirm(
        { query, kind: "whole", session: null, generation: 0 },
        "map_recenter",
      );
  });
  useEffect(() => {
    if (seenRecenter.current !== recenterId) {
      seenRecenter.current = recenterId;
      recenter();
    }
  }, [recenterId]);
  const clearLegacy = useEffectEvent(() => {
    if (!legacyQuery && mobile && usePlaceSearchStore.getState().query)
      invalidate(true);
  });
  useEffect(() => {
    if (seenLegacyNonce.current !== legacyNonce) {
      seenLegacyNonce.current = legacyNonce;
      clearLegacy();
    }
  }, [legacyNonce, legacyQuery]);

  return { confirm, invalidate, scopeKey };
}
