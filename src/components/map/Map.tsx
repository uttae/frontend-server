"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bookmark } from "lucide-react";
import {
  AdvancedMarker,
  Map as GoogleMap,
  useMap,
  useMapsLibrary,
  type MapCameraChangedEvent,
  type MapMouseEvent,
} from "@vis.gl/react-google-maps";

import { useSelectedPlace } from "@/contexts/SelectedPlaceContext";
import {
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  MAP_PAN_RESTRICTION,
  readDestinationLatLngFromSession,
  viewportSearchRadiusMetersFromBounds,
  writeDestinationLatLngToSession,
} from "@/lib/maps";
import {
  DESTINATION_MAP_ZOOM,
  useTripMapBootstrap,
} from "@/hooks/useTripMapBootstrap";
import {
  readRoomMapViewport,
  writeRoomMapViewport,
} from "@/lib/map-room-viewport-storage";
import { isPlanPath } from "@/lib/layout/mainChromeLayoutWidth";
import { clampPlacesSearchRadiusMeters } from "@/lib/places/placesSearchRadius";
import { useMapCenterStore } from "@/stores/map-center-store";
import { useSearchMapPinsStore } from "@/stores/search-map-pins-store";
import { useSessionStore } from "@/stores/session-store";
import { useMapPinsFocusStore } from "@/stores/map-pins-focus-store";
import { usePlanItineraryStopNormalizedPlaceIds } from "@/hooks/usePlanItineraryStopNormalizedPlaceIds";
import { useRoomDetail } from "@/hooks/useRoomDetail";
import { useRoomsList } from "@/hooks/useRooms";
import { MapPinIcon } from "@/components/icons";
import { MapPinWithPlaceName } from "@/components/map/MapPinWithPlaceName";
import { MapBookmarkPins } from "./MapBookmarkPins";
import {
  MAP_PIN_SELECTED_DISPLAY_SIZE_PX,
  mapPinBodyBorderProps,
} from "./map-pin-stroke";
import { MapSearchHereButton } from "./MapSearchHereButton";
import { MapDiscoverToolbar } from "./MapDiscoverToolbar";
import { MapDiscoverPlaces } from "./MapDiscoverPlaces";
import { PlanItineraryMapRoutes } from "./PlanItineraryMapRoutes";
import type { OpenValue, RatingValue } from "./map-filters";

// ─── 장소 선택 시 지도 이동 ───────────────────────────────────────────────────

function SelectedPlaceController() {
  const map = useMap();
  const { selectedPlace, placeSelectionCameraRef } = useSelectedPlace();

  useEffect(() => {
    if (!map || !selectedPlace?.location) return;
    const mode = placeSelectionCameraRef.current;
    placeSelectionCameraRef.current = "full";

    if (mode === "none") return;
    map.panTo(selectedPlace.location);
    if (mode === "full") {
      map.setZoom(16);
    }
  }, [map, selectedPlace?.location, placeSelectionCameraRef]);

  return null;
}

const VIEWPORT_PERSIST_DEBOUNCE_MS = 400;

/** bootstrap 복원 직후 Zustand `mapCenter`·줌을 검색/일정 UI와 맞춤 */
function MapBootstrapSync({
  ready,
  center,
  zoom,
  roomId,
}: {
  ready: boolean;
  center: google.maps.LatLngLiteral;
  zoom: number;
  roomId: string | null;
}) {
  const map = useMap();
  const setMapCamera = useMapCenterStore((s) => s.setMapCamera);
  const syncedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!map || !ready) return;
    const rid = typeof roomId === "string" ? roomId.trim() : "";
    const key = `${rid}:${center.lat}:${center.lng}:${zoom}`;
    if (syncedKeyRef.current === key) return;
    syncedKeyRef.current = key;

    const mapCenter = map.getCenter();
    const bounds = map.getBounds();
    const lat = mapCenter?.lat() ?? center.lat;
    const lng = mapCenter?.lng() ?? center.lng;
    const mapZoom = map.getZoom() ?? zoom;
    let radiusMeters = clampPlacesSearchRadiusMeters(2500);
    if (bounds && mapCenter) {
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      radiusMeters = viewportSearchRadiusMetersFromBounds(
        { lat: mapCenter.lat(), lng: mapCenter.lng() },
        {
          north: ne.lat(),
          south: sw.lat(),
          east: ne.lng(),
          west: sw.lng(),
        },
      );
    }

    setMapCamera({
      mapCenter: { lat, lng },
      zoom: mapZoom,
      radiusMeters,
    });
  }, [map, ready, center.lat, center.lng, zoom, roomId, setMapCamera]);

  return null;
}

/** 가로 월드 래핑(지도 타일 무한 복제) 시 마지막 유효 중심으로 되돌림 */
function MapPreventHorizontalWrap() {
  const map = useMap();
  const lastValidCenterRef = useRef<google.maps.LatLngLiteral | null>(null);

  useEffect(() => {
    if (!map) return;

    const listener = map.addListener("center_changed", () => {
      const bounds = map.getBounds();
      if (!bounds) return;

      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      if (ne.lng() > sw.lng()) {
        const c = map.getCenter();
        if (c) {
          lastValidCenterRef.current = { lat: c.lat(), lng: c.lng() };
        }
        return;
      }

      const last = lastValidCenterRef.current;
      if (last) {
        map.panTo(last);
      }
    });

    const c = map.getCenter();
    if (c) {
      lastValidCenterRef.current = { lat: c.lat(), lng: c.lng() };
    }

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [map]);

  return null;
}

// ─── 방 destination 변경 시 지도 동기화(설정 수정 등)·캐시 갱신 ───────────────

function DestinationPanController({
  roomId,
  destination,
}: {
  roomId: string | null;
  destination: string | null;
}) {
  const map = useMap();
  const geocodingLib = useMapsLibrary("geocoding");
  const appliedDestRef = useRef<string | null>(null);
  const lastRoomRef = useRef<string | null>(null);

  useEffect(() => {
    const rid = typeof roomId === "string" ? roomId.trim() : "";
    if (lastRoomRef.current !== rid) {
      lastRoomRef.current = rid.length > 0 ? rid : null;
      appliedDestRef.current = null;
    }
  }, [roomId]);

  useEffect(() => {
    const rid = typeof roomId === "string" ? roomId.trim() : "";
    const dest = typeof destination === "string" ? destination.trim() : "";
    if (!map || !dest.length || !geocodingLib) return;

    if (appliedDestRef.current === dest) return;

    const hadPreviousDest = appliedDestRef.current !== null;
    const savedViewport =
      rid.length > 0 ? readRoomMapViewport(rid) : null;
    if (!hadPreviousDest && savedViewport) {
      appliedDestRef.current = dest;
      return;
    }

    const fromCache =
      rid.length > 0 ? readDestinationLatLngFromSession(rid, dest) : null;
    if (fromCache) {
      map.setCenter(fromCache);
      map.setZoom(DESTINATION_MAP_ZOOM);
      appliedDestRef.current = dest;
      return;
    }

    const geocoder = new geocodingLib.Geocoder();
    geocoder.geocode({ address: dest }, (results, status) => {
      if (status === "OK" && results?.[0]?.geometry?.location) {
        const loc = results[0].geometry.location;
        const c = { lat: loc.lat(), lng: loc.lng() };
        map.setCenter(c);
        map.setZoom(DESTINATION_MAP_ZOOM);
        appliedDestRef.current = dest;
        if (rid.length) writeDestinationLatLngToSession(rid, dest, c);
      }
    });
  }, [map, geocodingLib, roomId, destination]);

  return null;
}

function MapSearchResultPins() {
  const pins = useSearchMapPinsStore((s) => s.pins);
  const pinsFocus = useMapPinsFocusStore((s) => s.focus);
  const { selectedPlace, setSelectedPlace } = useSelectedPlace();
  const selectedPlaceId = selectedPlace?.googlePlaceId?.trim() ?? "";

  if (pinsFocus !== "search") return null;

  return (
    <>
      {pins
        .filter((p) => p.googlePlaceId !== selectedPlaceId)
        .map((pin) => (
          <AdvancedMarker
            key={pin.googlePlaceId}
            position={{ lat: pin.lat, lng: pin.lng }}
            onClick={(e) => {
              e.stop();
              setSelectedPlace(
                {
                  name: pin.name,
                  category: "",
                  rating: null,
                  googlePlaceId: pin.googlePlaceId,
                  location: { lat: pin.lat, lng: pin.lng },
                },
                { analyticsSource: "map", preserveMapZoom: true },
              );
            }}
          >
            <MapPinWithPlaceName name={pin.name} />
          </AdvancedMarker>
        ))}
    </>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Map() {
  const pathname = usePathname();
  const isPlanPage = isPlanPath(pathname ?? "");
  const planStopPlaceIds = usePlanItineraryStopNormalizedPlaceIds(isPlanPage);

  const { selectedPlace, setSelectedPlace } = useSelectedPlace();
  const setMapCamera = useMapCenterStore((s) => s.setMapCamera);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [rating, setRating] = useState<RatingValue>("all");
  const [openNow, setOpenNow] = useState<OpenValue>("all");
  const [showBookmarkPins, setShowBookmarkPins] = useState(true);

  const currentRoomId = useSessionStore((s) => s.currentRoomId);
  const { data: roomsData, isFetched: roomsFetched } = useRoomsList();
  const { data: roomDetail, isFetched: roomDetailFetched } =
    useRoomDetail(currentRoomId);
  const listDestination =
    roomsData?.rooms.find((r) => r.id === currentRoomId)?.destinations?.[0] ??
    null;
  const detailDestination =
    roomDetail?.id === currentRoomId
      ? (roomDetail.destinations?.[0] ?? null)
      : null;
  const destination = listDestination ?? detailDestination;
  const mapMetaReady =
    roomsFetched || (roomDetailFetched && Boolean(destination?.trim()));

  const geocodingLib = useMapsLibrary("geocoding");
  const bootstrap = useTripMapBootstrap(
    currentRoomId,
    destination,
    mapMetaReady,
    geocodingLib,
  );

  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingViewportRef = useRef<{
    rid: string;
    lat: number;
    lng: number;
    zoom: number;
  } | null>(null);

  const flushViewportPersist = useCallback(() => {
    if (persistTimerRef.current !== null) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    const pending = pendingViewportRef.current;
    if (pending) {
      writeRoomMapViewport(pending.rid, {
        lat: pending.lat,
        lng: pending.lng,
        zoom: pending.zoom,
      });
      pendingViewportRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      flushViewportPersist();
    };
  }, [currentRoomId, flushViewportPersist]);

  const handleCameraChanged = useCallback(
    (ev: MapCameraChangedEvent) => {
      const { center, zoom, bounds } = ev.detail;
      const radiusMeters = viewportSearchRadiusMetersFromBounds(
        center,
        bounds,
      );
      setMapCamera({
        mapCenter: { lat: center.lat, lng: center.lng },
        zoom,
        radiusMeters,
      });

      const rid =
        typeof currentRoomId === "string" ? currentRoomId.trim() : "";
      if (!rid.length) return;

      pendingViewportRef.current = {
        rid,
        lat: center.lat,
        lng: center.lng,
        zoom,
      };
      if (persistTimerRef.current !== null) {
        clearTimeout(persistTimerRef.current);
      }
      persistTimerRef.current = setTimeout(() => {
        persistTimerRef.current = null;
        const pending = pendingViewportRef.current;
        if (pending?.rid === rid) {
          writeRoomMapViewport(pending.rid, {
            lat: pending.lat,
            lng: pending.lng,
            zoom: pending.zoom,
          });
          pendingViewportRef.current = null;
        }
      }, VIEWPORT_PERSIST_DEBOUNCE_MS);
    },
    [currentRoomId, setMapCamera],
  );

  const handleMapClick = (ev: MapMouseEvent) => {
    const placeId = ev.detail.placeId?.trim() ?? "";
    if (placeId.length > 0) {
      ev.stop();
      const latLng = ev.detail.latLng;
      setSelectedPlace(
        {
          name: "장소",
          category: "",
          rating: null,
          googlePlaceId: placeId,
          ...(latLng ? { location: latLng } : {}),
        },
        { analyticsSource: "map", skipMapRecenter: true },
      );
      return;
    }
    setSelectedPlace(null);
  };

  return (
    <div className="relative h-full min-h-0 w-full min-w-0">
      <div className="absolute inset-0 min-h-0 overflow-hidden">
        {!bootstrap.ready ? (
          <div
            className="h-full w-full bg-[#e8e6e3]"
            aria-busy="true"
            aria-label="지도 위치 불러오는 중"
          />
        ) : (
          <GoogleMap
            key={`${currentRoomId ?? "no-room"}:${destination ?? ""}`}
            defaultCenter={bootstrap.center}
            defaultZoom={bootstrap.zoom}
            minZoom={MAP_MIN_ZOOM}
            maxZoom={MAP_MAX_ZOOM}
            restriction={MAP_PAN_RESTRICTION}
            mapId="DEMO_MAP_ID"
            gestureHandling="greedy"
            disableDefaultUI
            zoomControl
            streetViewControl={false}
            mapTypeControl={false}
            fullscreenControl={false}
            clickableIcons={selectedCategoryId == null}
            onClick={handleMapClick}
            onCameraChanged={handleCameraChanged}
          >
          <MapBootstrapSync
            ready={bootstrap.ready}
            center={bootstrap.center}
            zoom={bootstrap.zoom}
            roomId={currentRoomId}
          />
          <MapPreventHorizontalWrap />
          <SelectedPlaceController />
          <DestinationPanController
            roomId={currentRoomId}
            destination={destination}
          />

          <PlanItineraryMapRoutes />

          <MapDiscoverPlaces
            selectedCategoryId={selectedCategoryId}
            rating={rating}
            openNow={openNow}
          />

          <MapBookmarkPins
            roomId={currentRoomId}
            enabled={showBookmarkPins}
            hiddenNormalizedPlaceIds={
              isPlanPage ? planStopPlaceIds : undefined
            }
          />

          <MapSearchResultPins />

          {selectedPlace?.location && (
            <AdvancedMarker
              position={selectedPlace.location}
              onClick={(e) => e.stop()}
            >
              <span
                className={`block drop-shadow-md ${
                  selectedPlace.fromBookmark
                    ? selectedPlace.bookmarkCategoryColor?.trim()
                      ? ""
                      : "text-secondary"
                    : "text-primary"
                }`}
                style={
                  selectedPlace.fromBookmark &&
                  selectedPlace.bookmarkCategoryColor?.trim()
                    ? { color: selectedPlace.bookmarkCategoryColor.trim() }
                    : undefined
                }
              >
                <MapPinIcon
                  size={MAP_PIN_SELECTED_DISPLAY_SIZE_PX}
                  {...mapPinBodyBorderProps}
                />
              </span>
            </AdvancedMarker>
          )}
          </GoogleMap>
        )}
      </div>

      <MapDiscoverToolbar
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={setSelectedCategoryId}
        rating={rating}
        openNow={openNow}
        setRating={setRating}
        setOpenNow={setOpenNow}
      />

      {!bootstrap.ready ? null : (
        <>
          <MapSearchHereButton discoverCategoryId={selectedCategoryId} />
          <div className="pointer-events-none absolute bottom-6 left-4 z-[16]">
            <button
              type="button"
              onClick={() => setShowBookmarkPins((v) => !v)}
              aria-pressed={showBookmarkPins}
              aria-label={
                showBookmarkPins
                  ? "북마크 장소 표시 끄기"
                  : "북마크 장소 표시 켜기"
              }
              title="북마크 장소 표시"
              className={`pointer-events-auto flex h-10 w-10 cursor-pointer items-center justify-center rounded-full shadow-md ring-2 ring-black/5 transition ${
                showBookmarkPins
                  ? "bg-primary text-white"
                  : "bg-white text-dark-gray hover:bg-gray-50"
              }`}
            >
              <Bookmark className="h-5 w-5" strokeWidth={2.2} aria-hidden />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
