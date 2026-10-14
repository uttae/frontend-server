"use client";

import { useEffect, useRef } from "react";
import { useSelectedPlace } from "@/contexts/SelectedPlaceContext";
import { MobilePlaceSearchScreen } from "@/components/search/MobilePlaceSearchScreen";
import type { MapSearchPlaceEntry } from "@/lib/map-search-history";
import { fetchPlaceDetail, normalizePreviewLocation } from "@/lib/places/place-queries";
import type { SearchConfirmation } from "@/lib/places/search-session";
import {
  placeSearchResultsToMapPins,
  setActiveSearchMapPins,
} from "@/lib/active-search-map-pins";
import { useMobileMapSearchStore } from "@/stores/mobile-map-search-store";
import { usePlaceSearchStore } from "@/stores/place-search-store";
import { useSearchRecenterStore } from "@/stores/search-recenter-store";
import { useMapPinsFocusStore } from "@/stores/map-pins-focus-store";

type Props = {
  confirm: (confirmation: SearchConfirmation) => Promise<boolean>;
  invalidate: (clear: boolean) => void;
  scopeKey: string;
  initialQuery?: string;
};
/** Existing mobile entry, with session-connected confirmation and cached result cards. */
export function MobileMapSearch({
  confirm,
  invalidate,
  scopeKey,
  initialQuery,
}: Props) {
  const textSearchNonce = useMobileMapSearchStore((s) => s.textSearchNonce);
  const textQuery = useMobileMapSearchStore((s) => s.textQuery);
  const open = useMobileMapSearchStore((s) => s.open);
  const closeSearch = useMobileMapSearchStore((s) => s.closeSearch);
  const setFocusInput = useMobileMapSearchStore((s) => s.setFocusInput);
  const { setSelectedPlace } = useSelectedPlace();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (initialQuery) useMobileMapSearchStore.getState().openSearch();
  }, [initialQuery]);
  useEffect(() => {
    setFocusInput(() => inputRef.current?.focus());
    return () => {
      setFocusInput(null);
      closeSearch();
    };
  }, [closeSearch, setFocusInput]);
  async function handleConfirm(confirmation: SearchConfirmation) {
    const success = await confirm(confirmation);
    if (success) closeSearch();
    return success;
  }
  async function handleSelectHistory(
    entry: MapSearchPlaceEntry,
  ): Promise<MapSearchPlaceEntry | null> {
    const generation = usePlaceSearchStore.getState().invalidate();
    // Saved-place selection owns the mobile result surface just like a new confirmation.
    setSelectedPlace(null);
    usePlaceSearchStore.setState({
      query: entry.name,
      confirmationKind: "specific",
      status: "pending",
      error: null,
    });
    try {
      const detail = await fetchPlaceDetail(entry.googlePlaceId);
      const state = usePlaceSearchStore.getState();
      if (state.generation !== generation || state.scope !== scopeKey)
        return null;
      const location = normalizePreviewLocation(detail.location);
      if (!location) throw new Error("장소 좌표를 확인할 수 없어요.");
      const item = {
        googlePlaceId: entry.googlePlaceId,
        name: detail.name || entry.name,
        address: detail.formattedAddress || entry.address,
        category: detail.primaryTypeDisplayName || detail.primaryType || "",
        rating: detail.rating,
        userRatingCount: detail.userRatingCount,
        isOpen: detail.regularOpeningHours?.openNow ?? null,
        location,
      };
      useMapPinsFocusStore.getState().claimFocus("search");
      usePlaceSearchStore.setState({
        items: [item],
        searchRankBuckets: {},
        selectedId: item.googlePlaceId,
        expanded: false,
        status: "done",
        error: null,
        fallback: false,
        termination: "not-requested",
        resolution: null,
        query: item.name,
        confirmationKind: "specific",
      });
      useSearchRecenterStore.getState().clearSearchSnapshot();
      setActiveSearchMapPins(placeSearchResultsToMapPins([item]));
      setSelectedPlace(item, {
        itinerarySource: "search",
        analyticsSource: "search",
      });
      useMobileMapSearchStore.setState({ textQuery: item.name });
      closeSearch();
      return {
        type: "place",
        googlePlaceId: item.googlePlaceId,
        name: item.name,
        address: item.address,
      };
    } catch {
      if (usePlaceSearchStore.getState().generation === generation)
        usePlaceSearchStore.setState({
          status: "error",
          error: "장소 정보를 불러오지 못했어요.",
        });
      return null;
    }
  }
  return (
    <MobilePlaceSearchScreen
      open={open}
      onClose={closeSearch}
      inputRef={inputRef}
      backLabel="지도로 돌아가기"
      onSelectPlace={handleSelectHistory}
      onConfirm={handleConfirm}
      onInvalidate={invalidate}
      scopeKey={scopeKey}
      initialQuery={textSearchNonce === 0 ? initialQuery : undefined}
      resetKey={!textQuery ? textSearchNonce : 0}
    />
  );
}
