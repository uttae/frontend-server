"use client";

import { AdvancedMarker, Polyline } from "@vis.gl/react-google-maps";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useMemo, type JSX } from "react";

import { useMobileView } from "@/contexts/MobileViewContext";
import { useSelectedPlace } from "@/contexts/SelectedPlaceContext";
import { useRoomSchedules, useScheduleItemMoveSavingDays } from "@/hooks/useRooms";
import {
  buildPlanItineraryRouteConnectorDotIcons,
  buildPlanItineraryRouteConnectorPaths,
  buildPlanItineraryRouteArrowIcons,
  decodeOrientedPlanItinerarySegmentPath,
  normalizeGooglePlaceResourceId,
} from "@/lib/maps";
import {
  loadScheduleItemRouteForMap,
  persistedScheduleItemRouteQueryOptions,
} from "@/lib/plan/scheduleItemRoutePersistedQuery";
import { schedulePlacesFingerprint } from "@/lib/plan/planTravelLocalStorage";
import { schedulePlanPlacesQueryOptions } from "@/lib/plan/scheduleItemPlaces";
import { scheduleIdsToRouteColors, sortedScheduleIdsForRouteColors } from "@/lib/plan/planRouteDayColors";
import { filterVisiblePlanMapStops, type PlanMapStopForOffset } from "@/lib/plan/planItineraryMapMarkerOffset";
import { flattenPlanItinerarySegmentsFromPlaces } from "@/lib/plan/planItineraryMapSegments";
import { planItinerarySegmentMapPathQueryKey } from "@/lib/query-keys";
import { usePlanScheduleRouteVisibilityStore } from "@/stores/plan-schedule-route-visibility-store";
import { usePlanMapFocusStore } from "@/stores/plan-map-focus-store";
import { useSessionStore } from "@/stores/session-store";

import { PlanItineraryStopMapPin } from "./PlanItineraryStopMapPin";

export type PlanItineraryRouteDay = {
  scheduleId: number | null;
  color: string;
  focusedItemId: number | null;
  routesReady: boolean;
  onStopClick: (itemId: number) => void;
};

export function PlanItineraryMapRoutes({
  routeDay,
}: {
  routeDay?: PlanItineraryRouteDay;
} = {}) {
  const roomIdRaw = useSessionStore((s) => s.currentRoomId);
  const rid = typeof roomIdRaw === "string" ? roomIdRaw.trim() : "";
  const queryClient = useQueryClient();
  const { isSuccess: schedulesHydrated } = useRoomSchedules(rid || null);

  const { selectedPlace, setSelectedPlace } = useSelectedPlace();
  const { isMobileDevice } = useMobileView();
  const focusPlace = usePlanMapFocusStore((s) => s.focusPlace);
  const webFocus = usePlanMapFocusStore((s) =>
    !routeDay && !isMobileDevice && s.focus && s.focus.roomId === rid ? s.focus : null,
  );
  const webFocusScheduleId = webFocus?.scheduleId ?? null;
  const webFocusNorm = webFocus?.googlePlaceId ? normalizeGooglePlaceResourceId(webFocus.googlePlaceId) : null;
  const selectedGid =
    !routeDay && selectedPlace?.googlePlaceId && selectedPlace.googlePlaceId.trim().length > 0
      ? normalizeGooglePlaceResourceId(selectedPlace.googlePlaceId.trim())
      : null;
  const selectedNorm = selectedGid !== null && selectedGid !== webFocusNorm ? selectedGid : null;

  const visibleByScheduleId = usePlanScheduleRouteVisibilityStore((s) => s.visibleByScheduleId);
  const visibilityOrder = usePlanScheduleRouteVisibilityStore((s) => s.visibilityOrder);
  const routeDayScheduleId = routeDay?.scheduleId ?? null;
  const inRouteView = routeDay != null;
  const routesReady = routeDay?.routesReady ?? true;
  const singleDayScheduleId = inRouteView ? routeDayScheduleId : webFocusScheduleId;
  const singleDay = inRouteView || webFocusScheduleId !== null;
  const visibleScheduleIds = useMemo(() => {
    if (singleDay) return singleDayScheduleId !== null ? [singleDayScheduleId] : [];
    return Object.keys(visibleByScheduleId)
      .map(Number)
      .filter((id) => Number.isFinite(id) && visibleByScheduleId[id] === true);
  }, [singleDay, singleDayScheduleId, visibleByScheduleId]);

  const orderedScheduleIdsForQueries = useMemo(
    () => [...visibleScheduleIds].sort((a, b) => a - b),
    [visibleScheduleIds],
  );

  const routeDayColor = routeDay?.color ?? null;
  const routeColorByScheduleId = useMemo(
    () =>
      routeDayScheduleId !== null && routeDayColor
        ? new Map([[routeDayScheduleId, routeDayColor]])
        : scheduleIdsToRouteColors(sortedScheduleIdsForRouteColors(visibleByScheduleId)),
    [routeDayColor, routeDayScheduleId, visibleByScheduleId],
  );
  const fallbackRouteStroke = "#f12d33";

  const placesQueries = useQueries({
    queries: orderedScheduleIdsForQueries.map((scheduleId) => ({
      ...schedulePlanPlacesQueryOptions(queryClient, rid, scheduleId),
      enabled: rid.length > 0 && orderedScheduleIdsForQueries.length > 0 && schedulesHydrated,
      refetchOnWindowFocus: false,
    })),
  });

  const savingMoveScheduleIds = useScheduleItemMoveSavingDays(rid);

  const buckets = orderedScheduleIdsForQueries.map((_, idx) => placesQueries[idx]?.data ?? []);
  const segments = flattenPlanItinerarySegmentsFromPlaces(routesReady ? orderedScheduleIdsForQueries : [], buckets);

  const fingerprintByScheduleId = new Map<number, string>(
    orderedScheduleIdsForQueries.map((scheduleId, bucketIdx) => [
      scheduleId,
      schedulePlacesFingerprint(buckets[bucketIdx] ?? []),
    ]),
  );

  const pathsPerSegmentQueries = useQueries({
    queries: segments.map((seg) => ({
      queryKey: planItinerarySegmentMapPathQueryKey(
        rid,
        seg.scheduleId,
        seg.segmentSourceItemId,
        seg.destinationItemId,
        seg.originPlaceId,
        seg.destPlaceId,
        seg.travelModeCanon,
      ),
      queryFn: async () => {
        const route = await loadScheduleItemRouteForMap(
          queryClient,
          persistedScheduleItemRouteQueryOptions(
            rid,
            seg.scheduleId,
            seg.segmentSourceItemId,
            seg.destinationItemId,
            seg.travelModeCanon,
            fingerprintByScheduleId.get(seg.scheduleId) ?? "",
            { segmentReady: true },
          ),
        );
        return {
          path: await decodeOrientedPlanItinerarySegmentPath(seg, route?.encodedPolyline),
        };
      },
      enabled: rid.length > 0 && segments.length > 0 && !savingMoveScheduleIds.includes(seg.scheduleId),
      staleTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: false,
    })),
  });

  const polylines: Array<JSX.Element> = [];
  segments.forEach((seg, segIdx) => {
    const query = pathsPerSegmentQueries[segIdx];
    if (!query || query.isPending || query.isFetching) return;
    const pts = query.data?.path ?? [];
    const polylineKey = `${seg.scheduleId}-${seg.segmentSourceItemId}-${seg.destinationItemId}-${seg.travelModeCanon}`;

    const routeColor = routeColorByScheduleId.get(seg.scheduleId) ?? fallbackRouteStroke;

    if (pts.length) {
      polylines.push(
        <Polyline
          key={polylineKey}
          zIndex={40 + segIdx}
          strokeColor={routeColor}
          strokeOpacity={0.8}
          strokeWeight={8}
          path={pts}
          icons={buildPlanItineraryRouteArrowIcons(routeColor)}
        />,
      );
    }

    const connectorPaths = buildPlanItineraryRouteConnectorPaths({
      path: pts,
      origin: seg.originLocation,
      dest: seg.destLocation,
    });
    connectorPaths.forEach((connectorPath, connectorIdx) => {
      polylines.push(
        <Polyline
          key={`${polylineKey}-connector-${connectorIdx}`}
          zIndex={35 + segIdx}
          strokeColor={routeColor}
          strokeOpacity={0}
          strokeWeight={8}
          path={connectorPath}
          icons={buildPlanItineraryRouteConnectorDotIcons(routeColor)}
        />,
      );
    });
  });

  const stopsForOffset = useMemo(() => {
    const out: PlanMapStopForOffset[] = [];
    orderedScheduleIdsForQueries.forEach((scheduleId, bucketIdx) => {
      const places = buckets[bucketIdx] ?? [];
      places.forEach((place, orderIndex) => {
        const loc = place.location;
        const gid = typeof place.googlePlaceId === "string" ? place.googlePlaceId.trim() : "";
        if (!loc || typeof place.itemId !== "number" || !gid.length) return;
        const legacyId = normalizeGooglePlaceResourceId(gid);
        if (selectedNorm != null && legacyId === selectedNorm) return;
        out.push({
          scheduleId,
          itemId: place.itemId,
          orderIndex,
          location: loc,
        });
      });
    });
    return out;
  }, [orderedScheduleIdsForQueries, buckets, selectedNorm]);

  const visibleStops = useMemo(
    () => filterVisiblePlanMapStops(stopsForOffset, singleDay ? visibleScheduleIds : visibilityOrder),
    [singleDay, stopsForOffset, visibilityOrder, visibleScheduleIds],
  );

  const placeByScheduleAndItemId = useMemo(() => {
    const map = new Map<string, { place: (typeof buckets)[number][number]; scheduleId: number }>();
    orderedScheduleIdsForQueries.forEach((scheduleId, bucketIdx) => {
      const places = buckets[bucketIdx] ?? [];
      places.forEach((place) => {
        if (typeof place.itemId !== "number") return;
        map.set(`${scheduleId}-${place.itemId}`, { place, scheduleId });
      });
    });
    return map;
  }, [orderedScheduleIdsForQueries, buckets]);

  const stopMarkers: Array<JSX.Element> = [];
  for (const stop of visibleStops) {
    const entry = placeByScheduleAndItemId.get(`${stop.scheduleId}-${stop.itemId}`);
    if (!entry) continue;
    const { place, scheduleId } = entry;
    const loc = place.location;
    const gid = typeof place.googlePlaceId === "string" ? place.googlePlaceId.trim() : "";
    if (!loc || !gid.length) continue;

    const legacyId = normalizeGooglePlaceResourceId(gid);
    const dayColor = routeColorByScheduleId.get(scheduleId) ?? fallbackRouteStroke;
    const focused =
      routeDay != null
        ? routeDay.focusedItemId === place.itemId
        : webFocus !== null && webFocus.scheduleId === scheduleId && webFocus.itemId === place.itemId;
    const itemId = place.itemId;
    stopMarkers.push(
      <AdvancedMarker
        key={`plan-stop-${scheduleId}-${place.itemId}`}
        position={loc}
        title={place.title}
        zIndex={focused ? 100 : undefined}
        onClick={(e) => {
          e.stop();
          if (routeDay && typeof itemId === "number") {
            routeDay.onStopClick(itemId);
            return;
          }
          setSelectedPlace(
            {
              name: place.title,
              category: "",
              rating: null,
              googlePlaceId: legacyId,
              location: loc,
              address: place.subtitle,
            },
            { analyticsSource: "plan", preserveMapZoom: true },
          );
          if (!isMobileDevice && typeof itemId === "number") {
            focusPlace({
              roomId: rid,
              scheduleId,
              itemId,
              googlePlaceId: legacyId,
              location: loc,
              source: "map",
            });
          }
        }}
      >
        <PlanItineraryStopMapPin
          orderLabel={stop.orderIndex + 1}
          pinColor={dayColor}
          emphasized={focused}
          className="cursor-pointer select-none"
        />
      </AdvancedMarker>,
    );
  }

  return (
    <>
      {polylines}
      {stopMarkers}
    </>
  );
}
