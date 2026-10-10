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
import { isMobileMapPathname } from "@/lib/mobile-view";
import { clampPlacesSearchRadiusMeters } from "@/lib/places/placesSearchRadius";
import { useMapCenterStore } from "@/stores/map-center-store";
import { useSearchMapPinsStore } from "@/stores/search-map-pins-store";
import { useSessionStore } from "@/stores/session-store";
import { useMapPinsFocusStore } from "@/stores/map-pins-focus-store";
import { usePlanItineraryStopNormalizedPlaceIds } from "@/hooks/usePlanItineraryStopNormalizedPlaceIds";
import { useRoomDetail } from "@/hooks/useRoomDetail";
import { useRoomsList } from "@/hooks/useRooms";
import { RouteIcon } from "@/assets/icons";
import { MapPinIcon } from "@/components/icons";
import { MapPinWithPlaceName } from "@/components/map/MapPinWithPlaceName";
import { MapBookmarkPins } from "./MapBookmarkPins";
import {
  MAP_PIN_SELECTED_DISPLAY_SIZE_PX,
  mapPinBodyBorderProps,
} from "./map-pin-stroke";
import { MapSearchHereButton } from "./MapSearchHereButton";
import { MapDiscoverToolbar } from "./MapDiscoverToolbar";
import { RouteViewCameraController } from "./RouteViewCameraController";
import { MapDiscoverPlaces } from "./MapDiscoverPlaces";
import { PlanItineraryMapRoutes, type PlanItineraryRouteDay } from "./PlanItineraryMapRoutes";
import type { OpenValue, RatingValue } from "./map-filters";

/** 모바일 경로 보기 — 고른 일차만 그리고, 카드 선택에 맞춰 지도를 옮긴다 */
export type MapRouteView = PlanItineraryRouteDay & {
  /**
   * `seq`가 바뀔 때마다 실행 — fit: 일차 전체가 보이게, pan: 줌은 두고 고른 장소로 이동,
   * place: 고른 장소를 가까이(줌 15) 보여 준다(일정 카드를 눌러 들어올 때)
   */
  camera: { kind: "fit" | "pan" | "place"; seq: number };
  /** 일차 장소 위치(순서대로) — 호출측에서 memo해 넘긴다 */
  locations: ReadonlyArray<{ itemId: number; lat: number; lng: number }>;
  /** 카드를 펼쳐 지도 아래쪽 대부분을 가리는 중 */
  expanded: boolean;
  /**
   * 지도에서 누른 Google 장소 — 카드 줄 사이에 끼운 후보(이 일차를 볼 때만). 일반 지도의 선택 핀으로 그린다.
   * `focused`: 후보 카드를 보고 있음 — 이때만 지도를 후보로 옮긴다.
   */
  candidate: {
    googlePlaceId: string;
    location: google.maps.LatLngLiteral | null;
    focused: boolean;
  } | null;
  onPlaceClick: (googlePlaceId: string, location: google.maps.LatLngLiteral | null) => void;
  /** 후보 핀을 누름 — 일정 핀처럼 그 후보 카드로 넘긴다 */
  onCandidateClick: () => void;
  /** 장소가 아닌 곳을 누름 — 후보를 닫는다 */
  onBackgroundClick: () => void;
};

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

export default function TripMap({
  routeView,
  onOpenRouteView,
}: {
  /** 있으면 경로 보기 — 검색·필터, 북마크·탐색 핀, 다른 일차 경로를 숨긴다 */
  routeView?: MapRouteView;
  /** 있으면 지도 왼쪽 아래에 경로 보기 버튼을 둔다(모바일 지도) */
  onOpenRouteView?: () => void;
} = {}) {
  const pathname = usePathname();
  // 모바일 지도(`/map`)도 일정 화면의 지도라 일정에 있는 장소의 북마크 핀을 숨긴다
  const isPlanPage = isPlanPath(pathname ?? "") || isMobileMapPathname(pathname ?? "");
  const planStopPlaceIds = usePlanItineraryStopNormalizedPlaceIds(isPlanPage);

  const { setSelectedPlace } = useSelectedPlace();
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
  const { destination, mapMetaReady } = resolveMapDestination(currentRoomId, roomsData, roomsFetched, roomDetail, roomDetailFetched);

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
    if (routeView) {
      // 경로 보기: 장소 상세 시트 대신 고른 카드 뒤에 넣을 후보로 보여 준다
      if (placeId.length > 0) {
        ev.stop();
        routeView.onPlaceClick(placeId, ev.detail.latLng ?? null);
      } else {
        routeView.onBackgroundClick();
      }
      return;
    }
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
            clickableIcons={Boolean(routeView) || selectedCategoryId == null}
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

          {routeView ? <RouteViewMarkers routeView={routeView} /> : (
            <>
              <PlanItineraryMapRoutes />
              <MapDiscoverPlaces selectedCategoryId={selectedCategoryId} rating={rating} openNow={openNow} />
              <MapBookmarkPins roomId={currentRoomId} enabled={showBookmarkPins}
                hiddenNormalizedPlaceIds={isPlanPage ? planStopPlaceIds : undefined} />
              <MapSearchResultPins />
            </>
          )}

          {!routeView && <SelectedPlaceMarker />}
          </GoogleMap>
        )}
      </div>

      {routeView ? null : (
        <MapDiscoverToolbar
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={setSelectedCategoryId}
          rating={rating}
          openNow={openNow}
          setRating={setRating}
          setOpenNow={setOpenNow}
        />
      )}

      {!bootstrap.ready || routeView ? null : (
        <>
          <MapSearchHereButton discoverCategoryId={selectedCategoryId} />
          <div className="pointer-events-none absolute bottom-6 left-4 z-[16] flex flex-col items-center gap-3">
            {onOpenRouteView ? (
              <button
                type="button"
                onClick={onOpenRouteView}
                aria-label="경로 보기"
                className="pointer-events-auto flex size-[42px] cursor-pointer items-center justify-center rounded-full bg-primary text-icon-inverse shadow-md transition-colors active:bg-primary-strong"
              >
                <RouteIcon size={24} />
              </button>
            ) : null}
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

function RouteViewMarkers({ routeView }: Readonly<{ routeView: MapRouteView }>) {
  return (
            <>
              <PlanItineraryMapRoutes routeDay={routeView} />
              <RouteViewCameraController
                camera={routeView.camera}
                locations={routeView.locations}
                focusedItemId={routeView.focusedItemId}
                expanded={routeView.expanded}
                candidate={routeView.candidate}
              />
              {routeView.candidate?.location ? (
                <AdvancedMarker
                  position={routeView.candidate.location}
                  zIndex={routeView.candidate.focused ? 200 : 90}
                  onClick={(e) => {
                    e.stop();
                    routeView.onCandidateClick();
                  }}
                >
                  <span className="block text-primary drop-shadow-md">
                    <MapPinIcon size={MAP_PIN_SELECTED_DISPLAY_SIZE_PX} {...mapPinBodyBorderProps} />
                  </span>
                </AdvancedMarker>
              ) : null}
            </>
  );
}

function SelectedPlaceMarker() {
  const { selectedPlace } = useSelectedPlace();
  const bookmarkColor = selectedPlace?.fromBookmark ? selectedPlace.bookmarkCategoryColor?.trim() : undefined;
  let colorClass = "text-primary";
  if (selectedPlace?.fromBookmark) colorClass = bookmarkColor ? "" : "text-secondary";
  return <>
          {selectedPlace?.location && (
            <AdvancedMarker
              position={selectedPlace.location}
              onClick={(e) => e.stop()}
            >
              <span
                className={`block drop-shadow-md ${colorClass}`}
                style={bookmarkColor ? { color: bookmarkColor } : undefined}
              >
                <MapPinIcon
                  size={MAP_PIN_SELECTED_DISPLAY_SIZE_PX}
                  {...mapPinBodyBorderProps}
                />
              </span>
            </AdvancedMarker>
          )}
  </>;
}

function resolveMapDestination(
  currentRoomId: string | null,
  roomsData: ReturnType<typeof useRoomsList>["data"],
  roomsFetched: boolean,
  roomDetail: ReturnType<typeof useRoomDetail>["data"],
  roomDetailFetched: boolean,
) {
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

  return { destination, mapMetaReady };
}
