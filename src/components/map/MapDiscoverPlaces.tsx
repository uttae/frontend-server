"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { AdvancedMarker, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";

import { useSelectedPlace } from "@/contexts/SelectedPlaceContext";
import { googlePlacesJsLocalizedText, normalizeGooglePlaceResourceId } from "@/lib/maps";
import { boundsInstanceFromDiscoverSnapshot, buildDiscoverSnapshotFromGoogleMap } from "@/lib/map-viewport-commit";

import { MapPinWithPlaceName } from "@/components/map/MapPinWithPlaceName";

import type { DiscoverMapSnapshot } from "@/stores/search-recenter-store";
import { useSearchRecenterStore } from "@/stores/search-recenter-store";
import { discoverPinWriteStillValid, useMapPinsFocusStore } from "@/stores/map-pins-focus-store";
import { clearActiveSearchMapPins } from "@/lib/active-search-map-pins";

import { MAP_PLACE_CATEGORIES } from "./map-place-categories";
import type { OpenValue, RatingValue } from "./map-filters";

const MAP_DISCOVER_MAX_RESULT_COUNT = 10;

const NEARBY_FIELDS: string[] = [
  "id",
  "displayName",
  "location",
  "rating",
  "regularOpeningHours",
  "primaryTypeDisplayName",
];

function matchesRatingFilter(filter: RatingValue, rating: number | null | undefined): boolean {
  if (filter === "all") return true;
  if (rating == null) return false;
  return rating >= Number(filter);
}

type DiscoverMarker = {
  id: string;
  position: google.maps.LatLngLiteral;
  title: string;
  place: google.maps.places.Place;
};

export type MapDiscoverPlacesProps = {
  selectedCategoryId: string | null;
  rating: RatingValue;
  openNow: OpenValue;
  onSearchFailedChange: (failed: boolean) => void;
};

function DiscoverMarkerPin({
  marker: m,
  selectedNormalized,
  categoryLabel,
  setSelectedPlace,
}: {
  marker: DiscoverMarker;
  selectedNormalized: string | null;
  categoryLabel: string;
  setSelectedPlace: ReturnType<typeof useSelectedPlace>["setSelectedPlace"];
}) {
  const legacyId = normalizeGooglePlaceResourceId(m.id);
  if (selectedNormalized && legacyId === selectedNormalized) return null;

  return (
    <AdvancedMarker
      position={m.position}
      title={m.title}
      onClick={(e) => {
        e.stop();
        const p = m.place;
        const loc = p.location;
        if (!loc) return;
        setSelectedPlace(
          {
            name: googlePlacesJsLocalizedText(p.displayName).trim() || "장소",
            category: googlePlacesJsLocalizedText(p.primaryTypeDisplayName).trim() || categoryLabel,
            rating: p.rating ?? null,
            googlePlaceId: legacyId,
            location: loc.toJSON(),
          },
          { analyticsSource: "map", preserveMapZoom: true },
        );
      }}
    >
      <MapPinWithPlaceName name={m.title} />
    </AdvancedMarker>
  );
}

export function MapDiscoverPlaces({
  selectedCategoryId,
  rating,
  openNow,
  onSearchFailedChange,
}: MapDiscoverPlacesProps) {
  const map = useMap();
  const placesLib = useMapsLibrary("places");
  const { selectedPlace, setSelectedPlace } = useSelectedPlace();
  const discoverRecenterRequestId = useSearchRecenterStore((s) => s.discoverRecenterRequestId);
  const pinsFocus = useMapPinsFocusStore((s) => s.focus);

  const [markers, setMarkers] = useState<DiscoverMarker[]>([]);

  const searchSeqRef = useRef(0);
  const prevCategoryIdRef = useRef<string | null>(null);
  const seenRecenterIdRef = useRef(discoverRecenterRequestId);

  const runDiscoverSearch = useCallback(
    async (
      snapshot: DiscoverMapSnapshot,
      categoryId: string,
      ratingVal: RatingValue,
      openVal: OpenValue,
      writeEpoch: number,
    ) => {
      const seq = ++searchSeqRef.current;
      onSearchFailedChange(false);

      if (!placesLib) {
        if (discoverPinWriteStillValid(writeEpoch) && seq === searchSeqRef.current) {
          setMarkers([]);
        }
        return;
      }

      const cat = MAP_PLACE_CATEGORIES.find((c) => c.id === categoryId);
      if (!cat) {
        if (discoverPinWriteStillValid(writeEpoch) && seq === searchSeqRef.current) {
          setMarkers([]);
        }
        return;
      }

      const filterBounds = boundsInstanceFromDiscoverSnapshot(snapshot.bounds);

      const Place = placesLib.Place;

      try {
        let places: google.maps.places.Place[];

        if (openVal === "open") {
          const textRequest: google.maps.places.SearchByTextRequest = {
            fields: NEARBY_FIELDS,
            textQuery: cat.searchQuery,
            includedType: cat.googlePlaceTypeHint,
            useStrictTypeFiltering: true,
            locationRestriction: snapshot.bounds,
            isOpenNow: true,
            maxResultCount: MAP_DISCOVER_MAX_RESULT_COUNT,
            language: "ko",
          };
          if (ratingVal !== "all") {
            textRequest.minRating = Number(ratingVal);
          }
          const res = await Place.searchByText(textRequest);
          places = res.places;
        } else {
          const radius = snapshot.radius > 0 ? snapshot.radius : 1;

          const request: google.maps.places.SearchNearbyRequest = {
            fields: NEARBY_FIELDS,
            includedPrimaryTypes: [cat.googlePlaceTypeHint],
            locationRestriction: {
              center: snapshot.center,
              radius,
            },
            maxResultCount: MAP_DISCOVER_MAX_RESULT_COUNT,
            language: "ko",
          };
          const res = await Place.searchNearby(request);
          places = res.places;
        }

        if (seq !== searchSeqRef.current) return;

        const list = places.filter((p) => {
          const loc = p.location;
          if (!loc) return false;
          if (!filterBounds.contains(loc)) return false;
          if (!matchesRatingFilter(ratingVal, p.rating)) return false;
          return true;
        });

        if (seq !== searchSeqRef.current) return;

        if (!discoverPinWriteStillValid(writeEpoch)) return;

        setMarkers(
          list.map((p) => ({
            id: p.id,
            position: p.location!.toJSON(),
            title: googlePlacesJsLocalizedText(p.displayName),
            place: p,
          })),
        );
      } catch {
        if (!discoverPinWriteStillValid(writeEpoch) || seq !== searchSeqRef.current) {
          return;
        }
        setMarkers([]);
        onSearchFailedChange(true);
      }
    },
    [placesLib, onSearchFailedChange],
  );

  useEffect(() => {
    if (pinsFocus === "discover") return;
    searchSeqRef.current += 1;
    queueMicrotask(() => {
      setMarkers([]);
    });
  }, [pinsFocus]);

  useEffect(() => {
    if (!selectedCategoryId) {
      prevCategoryIdRef.current = null;
      searchSeqRef.current += 1;
      queueMicrotask(() => {
        setMarkers([]);
      });
      useSearchRecenterStore.getState().clearDiscoverSnapshot();
      const focusState = useMapPinsFocusStore.getState();
      if (focusState.focus === "discover") focusState.releaseFocus();
      return;
    }

    if (!map || !placesLib) return;

    const catChanged = prevCategoryIdRef.current !== selectedCategoryId;

    if (catChanged) {
      const snap = buildDiscoverSnapshotFromGoogleMap(map);
      if (!snap) return;
      prevCategoryIdRef.current = selectedCategoryId;
      useSearchRecenterStore.getState().setDiscoverSnapshot(snap);
      const epoch = useMapPinsFocusStore.getState().claimFocus("discover");
      clearActiveSearchMapPins();
      queueMicrotask(() => {
        void runDiscoverSearch(snap, selectedCategoryId, rating, openNow, epoch);
      });
      return;
    }

    const existing = useSearchRecenterStore.getState().discoverSnapshot;
    if (!existing) return;
    const epochFilter = useMapPinsFocusStore.getState().claimFocus("discover");
    clearActiveSearchMapPins();
    queueMicrotask(() => {
      void runDiscoverSearch(existing, selectedCategoryId, rating, openNow, epochFilter);
    });
  }, [selectedCategoryId, rating, openNow, map, placesLib, runDiscoverSearch]);

  const recenterDiscover = useEffectEvent(() => {
    if (!selectedCategoryId || !map || !placesLib) return;
    const snapshot = buildDiscoverSnapshotFromGoogleMap(map);
    if (!snapshot) return;
    useSearchRecenterStore.getState().setDiscoverSnapshot(snapshot);
    const epochRecenter = useMapPinsFocusStore.getState().claimFocus("discover");
    clearActiveSearchMapPins();
    queueMicrotask(() => {
      void runDiscoverSearch(snapshot, selectedCategoryId, rating, openNow, epochRecenter);
    });
  });
  useEffect(() => {
    if (seenRecenterIdRef.current !== discoverRecenterRequestId) {
      seenRecenterIdRef.current = discoverRecenterRequestId;
      recenterDiscover();
    }
  }, [discoverRecenterRequestId]);

  const selectedNormalized = selectedPlace?.googlePlaceId
    ? normalizeGooglePlaceResourceId(selectedPlace.googlePlaceId)
    : null;

  const categoryLabel = MAP_PLACE_CATEGORIES.find((c) => c.id === selectedCategoryId)?.label ?? "";

  return (
    <>
      {pinsFocus === "discover" &&
        markers.map((m) => (
          <DiscoverMarkerPin
            key={m.id}
            marker={m}
            selectedNormalized={selectedNormalized}
            categoryLabel={categoryLabel}
            setSelectedPlace={setSelectedPlace}
          />
        ))}
    </>
  );
}
