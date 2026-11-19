"use client";

import { shouldSuggestPlacesSearchRecenter } from "@/lib/maps";
import { useMapCenterStore } from "@/stores/map-center-store";
import { usePlaceSearchStore } from "@/stores/place-search-store";
import type { DiscoverMapSnapshot } from "@/stores/search-recenter-store";
import { useSearchRecenterStore } from "@/stores/search-recenter-store";
import type { MapCenterCoords } from "@/stores/map-center-store";

type UsePlacesSearchHereVisibleParams = {
  discoverCategoryId: string | null;
  discoverFailed: boolean;
};

export type SearchRecenterNotice = "failed" | "empty";

export type PlacesSearchHereVisibility = {
  visible: boolean;
  suggestSearchRecenter: boolean;
  searchRecenterNotice: SearchRecenterNotice | null;
  suggestDiscoverRecenter: boolean;
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

  if (!chipChosen || discoverSnapshot == null) return false;

  return shouldSuggestPlacesSearchRecenter({
    mapCenter,
    snapshotCenter: discoverSnapshot.center,
    snapshotRadiusMeters: discoverSnapshot.radius,
    zoom,
    snapshotZoom: discoverSnapshot.zoom,
  });
}

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
