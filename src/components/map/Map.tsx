"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
import { MAP_DETAIL_PANEL_COVER_WIDTH } from "@/lib/layout-tokens";
import { isPlanPath } from "@/lib/layout/mainChromeLayoutWidth";
import { isMobileMapPathname } from "@/lib/mobile-view";
import { settleSearchSnapshotAfterMove } from "@/lib/map-viewport-commit";
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
import { MapPinWithPlaceName, MapPlaceName } from "@/components/map/MapPinWithPlaceName";
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

export type MapRouteView = PlanItineraryRouteDay & {
  camera: { kind: "fit" | "pan" | "place"; seq: number };
  locations: ReadonlyArray<{ itemId: number; lat: number; lng: number }>;
  expanded: boolean;
  candidate: {
    googlePlaceId: string;
    location: google.maps.LatLngLiteral | null;
    focused: boolean;
  } | null;
  onPlaceClick: (googlePlaceId: string, location: google.maps.LatLngLiteral | null) => void;
  onCandidateClick: () => void;
  onBackgroundClick: () => void;
};

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

const ZOOM_CONTROL_CLEARANCE_PX = 24 + 40 + 12;

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
      bounds: bounds?.toJSON() ?? null,
    });
  }, [map, ready, center.lat, center.lng, zoom, roomId, setMapCamera]);

  return null;
}

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

function releaseSearchForMapSelection() {
  usePlaceSearchStore.getState().invalidate();
  useMapPinsFocusStore.getState().releaseSearchFocusIfActive();
  useSearchMapPinsStore.getState().clearPins();
  useSearchRecenterStore.getState().clearSearchSnapshot();
}

const SEARCH_PREVIEW_GAP_OFFSET: [number, number] = [0, -4];

function MapSearchResultPins() {
  const map = useMap();
  const [previewMarker, setPreviewMarker] = useState<google.maps.marker.AdvancedMarkerElement | null>(null);
  const pins = useSearchMapPinsStore((s) => s.pins);
  const pinsFocus = useMapPinsFocusStore((s) => s.focus);
  const { selectedPlace, setSelectedPlace } = useSelectedPlace();
  const { isMobileDevice } = useMobileView();
  const searchSelectedId = usePlaceSearchStore((s) => s.selectedId);
  const items = usePlaceSearchStore((s) => s.items);
  const status = usePlaceSearchStore((s) => s.status);
  const kind = usePlaceSearchStore((s) => s.confirmationKind);
  const fittedItemsRef = useRef<typeof items | null>(null);
  const preview = pinsFocus === "search" && !isMobileDevice && kind === "whole" && !selectedPlace
    ? items.find((item) => item.googlePlaceId === searchSelectedId)
    : undefined;
  const selectedPlaceId = isMobileDevice && !selectedPlace ? searchSelectedId ?? "" : selectedPlace?.googlePlaceId?.trim() ?? "";

  useEffect(() => {
    if (!map || !preview) return;
    panToWithinWorld(map, preview.location);
    return settleSearchSnapshotAfterMove(map);
  }, [map, preview]);

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
    return settleSearchSnapshotAfterMove(map);
  }, [map, isMobileDevice, pinsFocus, kind, status, items]);

  if (pinsFocus !== "search") return null;

  return (
    <>
      {pins
        .filter((p) => p.googlePlaceId !== selectedPlaceId)
        .map((pin) => (
          <AdvancedMarker
            key={pin.googlePlaceId}
            ref={pin.googlePlaceId === preview?.googlePlaceId ? setPreviewMarker : undefined}
            zIndex={pin.googlePlaceId === searchSelectedId ? 1000 : 0}
            title={pin.name}
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
        <InfoWindow key={preview.googlePlaceId} anchor={previewMarker} pixelOffset={SEARCH_PREVIEW_GAP_OFFSET}
          maxWidth={260} shouldFocus={false} headerDisabled ariaLabel={`${preview.name} 미리보기`}
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

export default function TripMap({
  routeView,
  onOpenRouteView,
  search,
}: {
  routeView?: MapRouteView;
  search?: ReactNode;
  onOpenRouteView?: () => void;
} = {}) {
  const pathname = usePathname();
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
  const [discoverFailed, setDiscoverFailed] = useState(false);
  const [showBookmarkPins, setShowBookmarkPins] = useState(true);

  useEffect(() => useMapPinsFocusStore.subscribe((state, previous) => {
    if (state.focus !== "search" || state.writeEpoch === previous.writeEpoch) return;
    setSelectedCategoryId(null);
    setRating("all");
    setOpenNow("all");
  }), []);

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
        bounds,
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
        { analyticsSource: "map", ...(isMobileDevice ? { skipMapRecenter: true } : { preserveMapZoom: true }) },
      );
      return;
    }
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
          <SelectedPlaceController />
          {!routeView && isMobileDevice ? <MobileSearchSelection /> : null}
          {routeView || isMobileDevice ? null : <PlanFocusCameraController roomId={currentRoomId} />}
          <DestinationPanController
            roomId={currentRoomId}
            destination={destination}
          />

          {routeView ? <RouteViewMarkers routeView={routeView} /> : (
            <>
              <PlanItineraryMapRoutes />
              <MapDiscoverPlaces selectedCategoryId={selectedCategoryId} rating={rating} openNow={openNow} onSearchFailedChange={setDiscoverFailed} />
              <MapBookmarkPins roomId={currentRoomId} enabled={showBookmarkPins}
                hiddenNormalizedPlaceIds={isPlanPage ? planStopPlaceIds : undefined} />
              <MapSearchResultPins />
            </>
          )}

          {!routeView && <SelectedPlaceMarker />}

          {routeView || isMobileDevice ? null : (
            <MapControl position={ControlPosition.RIGHT_BOTTOM}>
              <div className="mr-6">{bookmarkToggle}</div>
            </MapControl>
          )}
          </GoogleMap>
        )}
      </div>

      {routeView ? null : (
        <MapDiscoverToolbar
          hidden={planRouteMode}
          search={search}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={setSelectedCategoryId}
          rating={rating}
          openNow={openNow}
          setRating={setRating}
          setOpenNow={setOpenNow}
        />
      )}

      {bootstrap.ready && !routeView && !isMobileDevice && isPlanPage ? (
        <div
          style={{
            paddingLeft: selectedPlace ? MAP_DETAIL_PANEL_COVER_WIDTH : 0,
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
          {planRouteMode ? null : <MapSearchHereButton discoverCategoryId={selectedCategoryId} discoverFailed={discoverFailed} />}
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
              zIndex={1000}
              title={selectedPlace.name}
              onClick={(e) => e.stop()}
            >
              <div className="flex flex-col items-center">
              <span
                className={`block drop-shadow-md ${colorClass}`}
                style={bookmarkColor ? { color: bookmarkColor } : undefined}
              >
                <MapPinIcon
                  size={MAP_PIN_SELECTED_DISPLAY_SIZE_PX}
                  {...mapPinBodyBorderProps}
                />
              </span>
              {!isMobileDevice ? <MapPlaceName name={selectedPlace.name}/> : null}
              </div>
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
    if (!map || focus !== "search" || selectedPlace || lat == null || lng == null) return;
    panToWithinWorld(map, { lat, lng });
    return settleSearchSnapshotAfterMove(map);
  }, [map, focus, selectedPlace, selectedId, lat, lng]);
  if (!item || focus !== "search" || selectedPlace) return null;
  return <AdvancedMarker position={item.location} onClick={(event) => event.stop()}><span className="block text-primary drop-shadow-md"><MapPinIcon size={MAP_PIN_SELECTED_DISPLAY_SIZE_PX} {...mapPinBodyBorderProps} /></span></AdvancedMarker>;
}
