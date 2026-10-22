"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import {
  AdvancedMarker,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";

import { useSelectedPlace } from "@/contexts/SelectedPlaceContext";
import {
  googlePlacesJsLocalizedText,
  normalizeGooglePlaceResourceId,
} from "@/lib/maps";
import {
  boundsInstanceFromDiscoverSnapshot,
  buildDiscoverSnapshotFromGoogleMap,
} from "@/lib/map-viewport-commit";

import { MapPinWithPlaceName } from "@/components/map/MapPinWithPlaceName";

import type { DiscoverMapSnapshot } from "@/stores/search-recenter-store";
import { useSearchRecenterStore } from "@/stores/search-recenter-store";
import {
  discoverPinWriteStillValid,
  useMapPinsFocusStore,
} from "@/stores/map-pins-focus-store";
import { clearActiveSearchMapPins } from "@/lib/active-search-map-pins";

import { MAP_PLACE_CATEGORIES } from "./map-place-categories";
import type { OpenValue, RatingValue } from "./map-filters";

/** 카테고리·필터 검색 1회당 Places API 결과 상한 */
const MAP_DISCOVER_MAX_RESULT_COUNT = 10;

/** Places API(New) field mask — camelCase 프로퍼티명과 동일 */
const NEARBY_FIELDS: string[] = [
  "id",
  "displayName",
  "location",
  "rating",
  "regularOpeningHours",
  "primaryTypeDisplayName",
];

function matchesRatingFilter(
  filter: RatingValue,
  rating: number | null | undefined,
): boolean {
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
  setSelectedPlace: ReturnType<
    typeof useSelectedPlace
  >["setSelectedPlace"];
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
            name:
              googlePlacesJsLocalizedText(p.displayName).trim()
              || "장소",
            category:
              googlePlacesJsLocalizedText(p.primaryTypeDisplayName).trim()
              || categoryLabel,
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
}: MapDiscoverPlacesProps) {
  const map = useMap();
  const placesLib = useMapsLibrary("places");
  const { selectedPlace, setSelectedPlace } = useSelectedPlace();
  const discoverRecenterRequestId = useSearchRecenterStore(
    (s) => s.discoverRecenterRequestId,
  );
  const pinsFocus = useMapPinsFocusStore((s) => s.focus);

  const [markers, setMarkers] = useState<DiscoverMarker[]>([]);

  const searchSeqRef = useRef(0);
  const prevCategoryIdRef = useRef<string | null>(null);
  // 요청 ID는 0으로 돌아가지 않는다. 마운트 때 값은 이미 처리한 요청으로 보고 새로 누른 요청만 검색한다
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

      if (!placesLib) {
        if (
          discoverPinWriteStillValid(writeEpoch)
          && seq === searchSeqRef.current
        ) {
          setMarkers([]);
        }
        return;
      }

      const cat = MAP_PLACE_CATEGORIES.find((c) => c.id === categoryId);
      if (!cat) {
        if (
          discoverPinWriteStillValid(writeEpoch)
          && seq === searchSeqRef.current
        ) {
          setMarkers([]);
        }
        return;
      }

      const filterBounds =
        boundsInstanceFromDiscoverSnapshot(snapshot.bounds);

      const Place = placesLib.Place;

      try {
        let places: google.maps.places.Place[];

        if (openVal === "open") {
          // Nearby Search에는 isOpenNow 없음 → Text Search로 서버 측 "현재 영업" 제한
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
          const radius =
            snapshot.radius > 0
              ? snapshot.radius
              : 1;

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
        if (
          !discoverPinWriteStillValid(writeEpoch)
          || seq !== searchSeqRef.current
        ) {
          return;
        }
        setMarkers([]);
      }
    },
    [placesLib],
  );

  /** Search가 맵 핀 소유 시 디스커버 마커 비우기·비행 응답 무효화 */
  useEffect(() => {
    if (pinsFocus === "discover") return;
    searchSeqRef.current += 1;
    queueMicrotask(() => {
      setMarkers([]);
    });
  }, [pinsFocus]);

  /** 카테고리 종료 시 정리 또는 카테고리·필터 변경 시 스냅샷 규칙에 따라 검색 */
  useEffect(() => {
    if (!selectedCategoryId) {
      prevCategoryIdRef.current = null;
      searchSeqRef.current += 1;
      queueMicrotask(() => {
        setMarkers([]);
      });
      useSearchRecenterStore.getState().clearDiscoverSnapshot();
      // Clearing a category must not release a newer text search or invalidate its response.
      const focusState = useMapPinsFocusStore.getState();
      if (focusState.focus === "discover") focusState.releaseFocus();
      return;
    }

    if (!map || !placesLib) return;

    const catChanged =
      prevCategoryIdRef.current !== selectedCategoryId;

    if (catChanged) {
      const snap = buildDiscoverSnapshotFromGoogleMap(map);
      if (!snap) return;
      prevCategoryIdRef.current = selectedCategoryId;
      useSearchRecenterStore.getState().setDiscoverSnapshot(snap);
      const epoch = useMapPinsFocusStore.getState().claimFocus("discover");
      clearActiveSearchMapPins();
      queueMicrotask(() => {
        void runDiscoverSearch(
          snap,
          selectedCategoryId,
          rating,
          openNow,
          epoch,
        );
      });
      return;
    }

    const existing =
      useSearchRecenterStore.getState().discoverSnapshot;
    if (!existing) return;
    const epochFilter = useMapPinsFocusStore.getState().claimFocus("discover");
    clearActiveSearchMapPins();
    queueMicrotask(() => {
      void runDiscoverSearch(
        existing,
        selectedCategoryId,
        rating,
        openNow,
        epochFilter,
      );
    });
  }, [
    selectedCategoryId,
    rating,
    openNow,
    map,
    placesLib,
    runDiscoverSearch,
  ]);

  /** `현 위치 검색` 버튼 → discover 스냅샷 갱신·재조회 */
  const recenterDiscover = useEffectEvent(() => {
    if (!selectedCategoryId || !map || !placesLib) return;
    const snapshot = buildDiscoverSnapshotFromGoogleMap(map);
    if (!snapshot) return;
    useSearchRecenterStore.getState().setDiscoverSnapshot(snapshot);
    const epochRecenter = useMapPinsFocusStore.getState().claimFocus("discover");
    clearActiveSearchMapPins();
    queueMicrotask(() => {
      void runDiscoverSearch(
        snapshot,
        selectedCategoryId,
        rating,
        openNow,
        epochRecenter,
      );
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

  const categoryLabel =
    MAP_PLACE_CATEGORIES.find((c) => c.id === selectedCategoryId)?.label ?? "";

  return (
    <>
      {pinsFocus === "discover"
        && markers.map((m) => (
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
