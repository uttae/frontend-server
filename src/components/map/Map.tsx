"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bookmark } from "lucide-react";
import {
  AdvancedMarker,
  InfoWindow,
  ControlPosition,
  Map as GoogleMap,
  MapControl,
  useMap,
  useMapsLibrary,
  type MapCameraChangedEvent,
  type MapMouseEvent,
} from "@vis.gl/react-google-maps";

import { useMobileView } from "@/contexts/MobileViewContext";
import { useSelectedPlace } from "@/contexts/SelectedPlaceContext";
import {
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  MAP_PAN_RESTRICTION,
  moveMapTo,
  normalizeGooglePlaceResourceId,
  panToWithinWorld,
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
import { MAP_DETAIL_PANEL_COVER_WIDTH_PX } from "@/lib/layout-tokens";
import { isPlanPath } from "@/lib/layout/mainChromeLayoutWidth";
import { isMobileMapPathname } from "@/lib/mobile-view";
import { clampPlacesSearchRadiusMeters } from "@/lib/places/placesSearchRadius";
import { useMapCenterStore } from "@/stores/map-center-store";
import { useSearchRecenterStore } from "@/stores/search-recenter-store";
import { usePlaceSearchStore } from "@/stores/place-search-store";
import { useSearchMapPinsStore } from "@/stores/search-map-pins-store";
import { useSessionStore } from "@/stores/session-store";
import { useMapPinsFocusStore } from "@/stores/map-pins-focus-store";
import { usePlanMapFocusStore } from "@/stores/plan-map-focus-store";
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
import { SearchPlacePreview } from "./SearchPlacePreview";
import { MapDiscoverToolbar } from "./MapDiscoverToolbar";
import { RouteViewCameraController } from "./RouteViewCameraController";
import { MapDiscoverPlaces } from "./MapDiscoverPlaces";
import { PlanItineraryMapRoutes, type PlanItineraryRouteDay } from "./PlanItineraryMapRoutes";
import { PlanRouteStepper } from "./PlanRouteStepper";
import { useWebPlanRouteMode } from "./useWebPlanRouteMode";
import type { OpenValue, RatingValue } from "./map-filters";

/** 모바일 경로 보기 — 고른 일차만 그리고, 카드 선택에 맞춰 지도를 옮긴다 */
export type MapRouteView = PlanItineraryRouteDay & {
  /**
   * `seq`가 바뀔 때마다 실행 — fit: 일차 전체가 보이게, pan: 줌은 두고 고른 장소로 이동,
   * place: 고른 장소를 가까이(줌 15) 보여 준다(경로 보기에 처음 들어올 때 — 일정 카드·경로 보기 버튼 모두)
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

// ─── 웹 일정에서 고른 장소로 지도 이동 ─────────────────────────────────────────

/**
 * 일정 카드·핀·장소 이동 스테퍼로 고르면 줌은 그대로 두고 그 장소로 부드럽게 옮긴다(모바일 경로 보기의 카드 넘김과 같은 이동).
 * 지도 핀으로 고르면 함께 연 상세(`SelectedPlaceController`)도 같은 곳으로 옮기는데, 같은 곳으로 가는 이동은 하나로 이어진다
 */
function PlanFocusCameraController({ roomId }: Readonly<{ roomId: string | null }>) {
  const map = useMap();
  const rid = typeof roomId === "string" ? roomId.trim() : "";
  const focusSeq = usePlanMapFocusStore((s) => (s.focus && s.focus.roomId === rid ? s.focus.seq : null));
  const lat = usePlanMapFocusStore((s) => (s.focus?.roomId === rid ? s.focus.location?.lat : undefined));
  const lng = usePlanMapFocusStore((s) => (s.focus?.roomId === rid ? s.focus.location?.lng : undefined));

  useEffect(() => {
    if (!map || focusSeq === null || lat === undefined || lng === undefined) return;
    return moveMapTo(map, { lat, lng });
  }, [map, focusSeq, lat, lng]);

  return null;
}

// ─── 장소 선택 시 지도 이동 ───────────────────────────────────────────────────

function SelectedPlaceController() {
  const map = useMap();
  const { isMobileDevice } = useMobileView();
  const { selectedPlace, placeSelectionCameraRef } = useSelectedPlace();

  useEffect(() => {
    if (!map || !selectedPlace?.location) return;
    const mode = placeSelectionCameraRef.current;
    placeSelectionCameraRef.current = "full";

    if (mode === "none") return;
    const zoom = mode === "full" ? 16 : undefined;
    // 모바일은 아직 구글 이동(`panTo`)을 그대로 쓴다
    if (isMobileDevice) {
      panToWithinWorld(map, selectedPlace.location);
      if (zoom !== undefined) map.setZoom(zoom);
      return;
    }
    moveMapTo(map, selectedPlace.location, { zoom });
  }, [map, isMobileDevice, selectedPlace?.location, placeSelectionCameraRef]);

  return null;
}

const VIEWPORT_PERSIST_DEBOUNCE_MS = 400;

/** 오른쪽 아래 확대·축소(+/−) 자리 — 지도 끝 24 + 버튼 40 + 간격 12. 장소 이동 스테퍼가 이보다 오른쪽으로 가지 않는다 */
const ZOOM_CONTROL_CLEARANCE_PX = 24 + 40 + 12;

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

/**
 * 가로 월드 래핑(지도 타일 무한 복제) 시 마지막 유효 중심으로 되돌림.
 * 되돌리는 동안에도 `center_changed`가 계속 오지만 같은 곳으로 가는 이동은 새로 시작하지 않는다(`moveMapTo`)
 */
function MapPreventHorizontalWrap() {
  const map = useMap();
  const { isMobileDevice } = useMobileView();
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
      if (!last) return;
      // 모바일은 아직 구글 이동(`panTo`)을 그대로 쓴다
      if (isMobileDevice) panToWithinWorld(map, last);
      else moveMapTo(map, last);
    });

    const c = map.getCenter();
    if (c) {
      lastValidCenterRef.current = { lat: c.lat(), lng: c.lng() };
    }

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [map, isMobileDevice]);

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

/** A new ordinary map selection supersedes search without deleting its reusable results. */
function releaseSearchForMapSelection() {
  usePlaceSearchStore.getState().invalidate();
  useMapPinsFocusStore.getState().releaseSearchFocusIfActive();
  useSearchMapPinsStore.getState().clearPins();
  useSearchRecenterStore.getState().clearSearchSnapshot();
}

const SEARCH_PREVIEW_OFFSET: [number, number] = [0, -40];

function MapSearchResultPins() {
  const map = useMap();
  const pins = useSearchMapPinsStore((s) => s.pins);
  const pinsFocus = useMapPinsFocusStore((s) => s.focus);
  const { selectedPlace, setSelectedPlace } = useSelectedPlace();
  const { isMobileDevice } = useMobileView();
  const searchSelectedId = usePlaceSearchStore((s) => s.selectedId);
  const items = usePlaceSearchStore((s) => s.items);
  const status = usePlaceSearchStore((s) => s.status);
  const kind = usePlaceSearchStore((s) => s.confirmationKind);
  const fittedItemsRef = useRef<typeof items | null>(null);
  const preview = !isMobileDevice && kind === "whole" && !selectedPlace
    ? items.find((item) => item.googlePlaceId === searchSelectedId)
    : undefined;
  const selectedPlaceId = isMobileDevice && !selectedPlace ? searchSelectedId ?? "" : selectedPlace?.googlePlaceId?.trim() ?? "";

  // 전체 검색 결과가 준비되면 첫 추천 대신 실제 결과들이 보이도록 맞춘다.
  useEffect(() => {
    if (!map || isMobileDevice || pinsFocus !== "search" || kind !== "whole" || status !== "done" || !items.length || usePlaceSearchStore.getState().selectedId || fittedItemsRef.current === items) return;
    fittedItemsRef.current = items;
    if (items.length === 1) {
      moveMapTo(map, items[0].location, { zoom: 16 });
    } else {
      const bounds = new google.maps.LatLngBounds();
      items.forEach((item) => bounds.extend(item.location));
      map.fitBounds(bounds, 80);
    }
  }, [map, isMobileDevice, pinsFocus, kind, status, items]);

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
              const result = usePlaceSearchStore.getState().items.find((item) => item.googlePlaceId === pin.googlePlaceId);
              if (result) {
                usePlaceSearchStore.getState().select(result.googlePlaceId);
                if (!isMobileDevice && kind === "specific") {
                  setSelectedPlace(result, { itinerarySource: "search", analyticsSource: "search", preserveMapZoom: true });
                } else {
                  setSelectedPlace(null);
                }
                return;
              }
              releaseSearchForMapSelection();
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
      {preview ? (
        <InfoWindow key={preview.googlePlaceId} position={preview.location} pixelOffset={SEARCH_PREVIEW_OFFSET}
          maxWidth={280} shouldFocus headerDisabled ariaLabel={`${preview.name} 미리보기`}
          onClose={() => {
            if (usePlaceSearchStore.getState().selectedId === preview.googlePlaceId)
              usePlaceSearchStore.getState().select(null);
          }}>
          <SearchPlacePreview place={preview} onClose={() => usePlaceSearchStore.getState().select(null)} onOpenDetail={() => {
            setSelectedPlace(preview, {
              itinerarySource: "search", analyticsSource: "search",
              analyticsRankBucket: usePlaceSearchStore.getState().searchRankBuckets[preview.googlePlaceId],
              preserveMapZoom: true,
            });
          }} />
        </InfoWindow>
      ) : null}
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

  const { selectedPlace, setSelectedPlace } = useSelectedPlace();
  const { isMobileDevice } = useMobileView();
  const clearPlanFocus = usePlanMapFocusStore((s) => s.clearFocus);
  const planRouteMode = useWebPlanRouteMode();
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
      releaseSearchForMapSelection();
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
        // 웹은 누른 장소로 줌을 두고 부드럽게 옮긴다. 모바일은 아래 시트가 지도를 가려 그대로 둔다
        { analyticsSource: "map", ...(isMobileDevice ? { skipMapRecenter: true } : { preserveMapZoom: true }) },
      );
      return;
    }
    // 빈 곳은 완료된 검색 핀·카드를 유지한다. 진행 중인 응답만 무효화하고 상세·일정 강조를 닫는다.
    if (usePlaceSearchStore.getState().status === "pending") usePlaceSearchStore.getState().invalidate();
    if (!isMobileDevice) usePlaceSearchStore.getState().select(null);
    setSelectedPlace(null);
    clearPlanFocus();
  };

  const bookmarkToggle = (
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
  );

  return (
    <div className="relative h-full min-h-0 w-full min-w-0" data-map-controls-inset={isMobileDevice ? undefined : ""}>
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
          {!routeView && isMobileDevice ? <MobileSearchSelection /> : null}
          {/* 웹 일정에서 고른 장소로 이동 — 모바일(일반 지도·경로 보기)은 쓰지 않는다 */}
          {routeView || isMobileDevice ? null : <PlanFocusCameraController roomId={currentRoomId} />}
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

          {/* PC는 확대·축소(+/−) 바로 위 — 같은 오른쪽 아래 컨트롤 자리에 넣으면 지도가 +/− 위로 쌓아 준다.
              오른쪽은 +/−와 같이 지도 끝에서 24px(globals.css `[data-map-controls-inset]`) */}
          {routeView || isMobileDevice ? null : (
            <MapControl position={ControlPosition.RIGHT_BOTTOM}>
              <div className="mr-6">{bookmarkToggle}</div>
            </MapControl>
          )}
          </GoogleMap>
        )}
      </div>

      {/* 웹 동선보기는 숨기기만 한다 — 상세 패널 위치를 계속 재서 필터 한 줄 아래(최솟값)에 두고, 풀면 고른 카테고리·필터 그대로 보인다 */}
      {routeView ? null : (
        <MapDiscoverToolbar
          hidden={planRouteMode}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={setSelectedCategoryId}
          rating={rating}
          openNow={openNow}
          setRating={setRating}
          setOpenNow={setOpenNow}
        />
      )}

      {/* 웹 동선보기 장소 이동 — 지도 아래 가운데, 다른 지도 버튼처럼 아래 24px.
          상세 패널이 열리면 패널 오른쪽 끝~지도 오른쪽 끝의 가운데로 옮긴다.
          오른쪽 칸은 +/− 자리만큼 줄어들지 않아, 지도가 좁아지면 +/−에 밀려 왼쪽으로 넘치고(justify-end)
          z-[16]이 상세 패널(`MapWithDetailPanel` z-20)보다 낮아 패널 뒤로 가려진다 */}
      {bootstrap.ready && !routeView && !isMobileDevice && isPlanPage ? (
        <div
          style={{
            paddingLeft: selectedPlace ? MAP_DETAIL_PANEL_COVER_WIDTH_PX : 0,
            gridTemplateColumns: `minmax(0, 1fr) auto minmax(${ZOOM_CONTROL_CLEARANCE_PX}px, 1fr)`,
          }}
          className="pointer-events-none absolute inset-x-0 bottom-6 z-[16] grid justify-end transition-[padding] duration-300 ease-out"
        >
          <div className="col-start-2">
            <PlanRouteStepper roomId={currentRoomId} />
          </div>
        </div>
      ) : null}

      {!bootstrap.ready || routeView ? null : (
        <>
          {planRouteMode ? null : <MapSearchHereButton discoverCategoryId={selectedCategoryId} />}
          {isMobileDevice ? (
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
              {bookmarkToggle}
            </div>
          ) : null}
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
  const { isMobileDevice } = useMobileView();
  // 고른 일정 장소를 핀으로 열었으면 번호 핀을 키워 보이므로 일반 선택 핀을 겹쳐 그리지 않는다(웹 전용)
  const planFocusGid = usePlanMapFocusStore((s) => (isMobileDevice ? null : (s.focus?.googlePlaceId ?? null)));
  const selectedIsPlanFocus =
    planFocusGid !== null &&
    typeof selectedPlace?.googlePlaceId === "string" &&
    normalizeGooglePlaceResourceId(selectedPlace.googlePlaceId.trim()) ===
      normalizeGooglePlaceResourceId(planFocusGid.trim());
  const bookmarkColor = selectedPlace?.fromBookmark ? selectedPlace.bookmarkCategoryColor?.trim() : undefined;
  let colorClass = "text-primary";
  if (selectedPlace?.fromBookmark) colorClass = bookmarkColor ? "" : "text-secondary";
  return <>
          {selectedPlace?.location && !selectedIsPlanFocus && (
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

/** A search card selection only pans the map; collapsed cards do not fetch Details. */
function MobileSearchSelection() {
  const map = useMap();
  const items = usePlaceSearchStore((s) => s.items);
  const selectedId = usePlaceSearchStore((s) => s.selectedId);
  const focus = useMapPinsFocusStore((s) => s.focus);
  const { selectedPlace } = useSelectedPlace();
  const item = items.find((value) => value.googlePlaceId === selectedId);
  const lat = item?.location.lat;
  const lng = item?.location.lng;
  useEffect(() => {
    if (map && focus === "search" && !selectedPlace && lat != null && lng != null) panToWithinWorld(map, { lat, lng });
  }, [map, focus, selectedPlace, selectedId, lat, lng]);
  if (!item || focus !== "search" || selectedPlace) return null;
  return <AdvancedMarker position={item.location} onClick={(event) => event.stop()}><span className="block text-primary drop-shadow-md"><MapPinIcon size={MAP_PIN_SELECTED_DISPLAY_SIZE_PX} {...mapPinBodyBorderProps} /></span></AdvancedMarker>;
}
