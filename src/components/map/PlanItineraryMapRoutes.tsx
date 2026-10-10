"use client";

/// <reference types="google.maps" />

import { AdvancedMarker, Polyline } from "@vis.gl/react-google-maps";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, type JSX } from "react";

import { useSelectedPlace } from "@/contexts/SelectedPlaceContext";
import { useRoomSchedules } from "@/hooks/useRooms";
import {
  buildPlanItineraryRouteConnectorDotIcons,
  buildPlanItineraryRouteConnectorPaths,
  buildPlanItineraryRouteArrowIcons,
  decodeOrientedPlanItinerarySegmentPath,
  normalizeGooglePlaceResourceId,
} from "@/lib/maps";
import { persistedScheduleItemRouteQueryOptions } from "@/lib/plan/scheduleItemRoutePersistedQuery";
import { schedulePlacesFingerprint } from "@/lib/plan/planTravelLocalStorage";
import { readSchedulePlanPlacesFromCache } from "@/lib/plan/scheduleItemPlaces";
import {
  scheduleIdsToRouteColors,
  sortedScheduleIdsForRouteColors,
} from "@/lib/plan/planRouteDayColors";
import {
  filterVisiblePlanMapStops,
  type PlanMapStopForOffset,
} from "@/lib/plan/planItineraryMapMarkerOffset";
import {
  flattenPlanItinerarySegmentsFromPlaces,
} from "@/lib/plan/planItineraryMapSegments";
import {
  planItinerarySegmentMapPathQueryKey,
  scheduleItemsQueryKey,
} from "@/lib/query-keys";
import {
  planMapSegmentEpochStoreKey,
  usePlanMapDirectionsEpochStore,
} from "@/stores/plan-map-directions-epoch-store";
import { usePlanScheduleRouteVisibilityStore } from "@/stores/plan-schedule-route-visibility-store";
import { useSessionStore } from "@/stores/session-store";

import { PlanItineraryStopMapPin } from "./PlanItineraryStopMapPin";

/**
 * 일차별 "지도에 경로 표시" 토글(`usePlanScheduleRouteVisibilityStore`) ON인
 * 일차만 지도에 경로(polyline)와 정류장 마커를 그립니다.
 * `routeDay`가 있으면(모바일 경로 보기) 토글과 관계없이 그 일차만 그립니다.
 * 폴리라인 travelMode는 서버에 저장된 구간별 공유 이동수단을 따릅니다.
 * STOMP 에폭은 {@link usePlanMapDirectionsEpochStore} 참고.
 */
/** 모바일 경로 보기 — 고른 일차 하나만 그린다 */
export type PlanItineraryRouteDay = {
  /** 일차를 아직 못 정했으면(불러오는 중·일차 없음) 아무것도 그리지 않는다 */
  scheduleId: number | null;
  /** 일정 화면과 같은 일차 색 */
  color: string;
  /** 카드로 고른 장소 — 핀을 크게 강조한다 */
  focusedItemId: number | null;
  /** 일차 구간 경로 batch(`usePrefetchScheduleRoutes`)가 끝나기 전에는 구간을 조회하지 않는다 */
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
  // 경로 보기는 선택 장소도 일차 핀으로 강조해 보여 준다 — 일반 선택 핀으로 바꾸지 않는다
  const selectedNorm =
    !routeDay &&
    selectedPlace?.googlePlaceId &&
    selectedPlace.googlePlaceId.trim().length > 0
      ? normalizeGooglePlaceResourceId(selectedPlace.googlePlaceId.trim())
      : null;

  const visibleByScheduleId = usePlanScheduleRouteVisibilityStore(
    (s) => s.visibleByScheduleId,
  );
  const visibilityOrder = usePlanScheduleRouteVisibilityStore(
    (s) => s.visibilityOrder,
  );
  // 경로 보기 값은 렌더마다 새 객체라, 메모·쿼리 옵션에서는 아래 원시값만 읽는다
  const routeDayScheduleId = routeDay?.scheduleId ?? null;
  const inRouteView = routeDay != null;
  const routesReady = routeDay?.routesReady ?? true;
  const visibleScheduleIds = useMemo(
    () => {
      if (inRouteView) return routeDayScheduleId !== null ? [routeDayScheduleId] : [];
      return Object.keys(visibleByScheduleId)
        .map(Number)
        .filter((id) => Number.isFinite(id) && visibleByScheduleId[id] === true);
    },
    [inRouteView, routeDayScheduleId, visibleByScheduleId],
  );

  const directionsEpoch = usePlanMapDirectionsEpochStore((s) =>
    rid.length > 0 ? (s.epochByRoomId[rid] ?? 0) : 0,
  );
  const epochBySegmentKey = usePlanMapDirectionsEpochStore(
    (s) => s.epochBySegmentKey,
  );
  const syncRouteRenderStatuses = usePlanMapDirectionsEpochStore(
    (s) => s.syncRouteRenderStatuses,
  );

  const orderedScheduleIdsForQueries = useMemo(
    () => [...visibleScheduleIds].sort((a, b) => a - b),
    [visibleScheduleIds],
  );

  const routeDayColor = routeDay?.color ?? null;
  const routeColorByScheduleId = useMemo(
    () =>
      routeDayScheduleId !== null && routeDayColor
        ? new Map([[routeDayScheduleId, routeDayColor]])
        : scheduleIdsToRouteColors(
            sortedScheduleIdsForRouteColors(visibleByScheduleId),
            rid || undefined,
          ),
    [routeDayColor, routeDayScheduleId, visibleByScheduleId, rid],
  );
  const fallbackRouteStroke = "#f12d33";

  const placesQueries = useQueries({
    queries: orderedScheduleIdsForQueries.map((scheduleId) => ({
      queryKey: scheduleItemsQueryKey(rid || null, scheduleId),
      queryFn: () => readSchedulePlanPlacesFromCache(queryClient, rid, scheduleId),
      enabled:
        rid.length > 0 &&
        orderedScheduleIdsForQueries.length > 0 &&
        schedulesHydrated,
      staleTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    })),
  });

  const buckets = orderedScheduleIdsForQueries.map(
    (_, idx) => placesQueries[idx]?.data ?? [],
  );
  // 경로 보기는 일차 구간 경로 batch가 끝난 뒤에 구간을 조회한다(그 전엔 핀만 그린다)
  const segments = flattenPlanItinerarySegmentsFromPlaces(
    routesReady ? orderedScheduleIdsForQueries : [],
    buckets,
  );

  /**
   * sessionStorage 시드가 일정 변경 뒤 엇나가지 않도록 리스트와 같은 지문을 넘깁니다.
   * `buckets`는 매 렌더 새로 만들어지므로 memo 없이 그때그때 계산합니다.
   */
  const fingerprintByScheduleId = new Map<number, string>(
    orderedScheduleIdsForQueries.map((scheduleId, bucketIdx) => [
      scheduleId,
      schedulePlacesFingerprint(buckets[bucketIdx] ?? []),
    ]),
  );

  const pathsPerSegmentQueries = useQueries({
    queries: segments.map((seg) => {
      const epochKey = planMapSegmentEpochStoreKey(
        rid,
        seg.scheduleId,
        seg.segmentSourceItemId,
      );
      const segmentEpoch = epochBySegmentKey[epochKey] ?? 0;

      return {
        queryKey: planItinerarySegmentMapPathQueryKey(
          rid,
          seg.scheduleId,
          seg.segmentSourceItemId,
          seg.originPlaceId,
          seg.destPlaceId,
          seg.travelModeCanon,
          directionsEpoch,
          segmentEpoch,
        ),
        /**
         * 구간 경로는 일정 리스트와 같은 쿼리를 통해 가져옵니다. `fetchQuery`에 맡겨야
         * in-flight 합치기와 재정렬 중 뒤늦게 온 응답 폐기를 React Query가 처리합니다.
         */
        queryFn: async () => {
          const route = await queryClient.fetchQuery(
            persistedScheduleItemRouteQueryOptions(
              rid,
              seg.scheduleId,
              seg.segmentSourceItemId,
              seg.travelModeCanon,
              fingerprintByScheduleId.get(seg.scheduleId) ?? "",
              { segmentReady: true },
            ),
          );
          /** 경로 없음과 "경로는 있는데 폴리라인이 없음"을 구분해야 렌더링 경고가 정확해집니다. */
          return {
            path: await decodeOrientedPlanItinerarySegmentPath(
              seg,
              route?.encodedPolyline,
            ),
            hasRoute: route != null,
          };
        },
        enabled: rid.length > 0 && segments.length > 0,
        staleTime: Infinity,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: false,
      };
    }),
  });

  const routeRenderStatusEntries = useMemo(
    () =>
      segments.map((seg, index) => {
        const query = pathsPerSegmentQueries[index];
        const status =
          !query || query.isPending || query.isFetching
            ? "loading"
            : query.isError
              ? "unavailable"
              : !query.data?.hasRoute
                ? "no-route"
                : !query.data.path.length
                  ? "unavailable"
                  : "available";
        return {
          scheduleId: seg.scheduleId,
          segmentSourceItemId: seg.segmentSourceItemId,
          status,
        } as const;
      }),
    [segments, pathsPerSegmentQueries],
  );

  useEffect(() => {
    syncRouteRenderStatuses(rid, routeRenderStatusEntries);
  }, [rid, routeRenderStatusEntries, syncRouteRenderStatuses]);

  const polylines: Array<JSX.Element> = [];
  segments.forEach((seg, segIdx) => {
    const query = pathsPerSegmentQueries[segIdx];
    if (!query || query.isPending || query.isFetching) return;
    const pts = query.data?.path ?? [];

    const segEpochKey = planMapSegmentEpochStoreKey(
      rid,
      seg.scheduleId,
      seg.segmentSourceItemId,
    );
    const segEpoch = epochBySegmentKey[segEpochKey] ?? 0;

    const routeColor =
      routeColorByScheduleId.get(seg.scheduleId) ?? fallbackRouteStroke;

    if (pts.length) {
      polylines.push(
        <Polyline
          key={`${seg.scheduleId}-${seg.segmentSourceItemId}-${seg.travelModeCanon}-${directionsEpoch}-${segEpoch}`}
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
          key={`${seg.scheduleId}-${seg.segmentSourceItemId}-${seg.travelModeCanon}-${directionsEpoch}-${segEpoch}-connector-${connectorIdx}`}
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
        const gid =
          typeof place.googlePlaceId === "string"
            ? place.googlePlaceId.trim()
            : "";
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
    () =>
      filterVisiblePlanMapStops(
        stopsForOffset,
        inRouteView ? visibleScheduleIds : visibilityOrder,
      ),
    [inRouteView, stopsForOffset, visibilityOrder, visibleScheduleIds],
  );

  const placeByScheduleAndItemId = useMemo(() => {
    const map = new Map<
      string,
      { place: (typeof buckets)[number][number]; scheduleId: number }
    >();
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
    const entry = placeByScheduleAndItemId.get(
      `${stop.scheduleId}-${stop.itemId}`,
    );
    if (!entry) continue;
    const { place, scheduleId } = entry;
    const loc = place.location;
    const gid =
      typeof place.googlePlaceId === "string" ? place.googlePlaceId.trim() : "";
    if (!loc || !gid.length) continue;

    const legacyId = normalizeGooglePlaceResourceId(gid);
    const dayColor =
      routeColorByScheduleId.get(scheduleId) ?? fallbackRouteStroke;
    const focused = routeDay != null && routeDay.focusedItemId === place.itemId;
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
