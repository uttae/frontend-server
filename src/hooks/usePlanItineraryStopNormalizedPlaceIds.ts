"use client";

import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { useRoomSchedules } from "@/hooks/useRooms";
import { normalizeGooglePlaceResourceId } from "@/lib/maps";
import { schedulePlanPlacesQueryOptions } from "@/lib/plan/scheduleItemPlaces";
import { usePlanScheduleRouteVisibilityStore } from "@/stores/plan-schedule-route-visibility-store";
import { useSessionStore } from "@/stores/session-store";

const EMPTY = new Set<string>();

/** 지도에 정류장 마커가 그려지는(=경로 표시 ON) 일차 장소의 정규화된 `googlePlaceId` — 북마크 핀 중복 숨김용. */
export function usePlanItineraryStopNormalizedPlaceIds(
  enabled: boolean,
): ReadonlySet<string> {
  const roomIdRaw = useSessionStore((s) => s.currentRoomId);
  const rid = typeof roomIdRaw === "string" ? roomIdRaw.trim() : "";
  const queryClient = useQueryClient();
  const { isSuccess: schedulesHydrated } = useRoomSchedules(rid || null);

  const visibleByScheduleId = usePlanScheduleRouteVisibilityStore(
    (s) => s.visibleByScheduleId,
  );
  const visibleScheduleIds = useMemo(
    () =>
      Object.keys(visibleByScheduleId)
        .map((k) => Number(k))
        .filter(
          (id) => Number.isFinite(id) && visibleByScheduleId[id] === true,
        ),
    [visibleByScheduleId],
  );

  const orderedScheduleIdsForQueries = useMemo(
    () => [...visibleScheduleIds].sort((a, b) => a - b),
    [visibleScheduleIds],
  );

  const placesQueries = useQueries({
    queries: orderedScheduleIdsForQueries.map((scheduleId) => ({
      ...schedulePlanPlacesQueryOptions(queryClient, rid, scheduleId),
      enabled:
        enabled &&
        rid.length > 0 &&
        orderedScheduleIdsForQueries.length > 0 &&
        schedulesHydrated,
      refetchOnWindowFocus: false,
    })),
  });

  return useMemo(() => {
    if (!enabled || rid.length === 0) return EMPTY;

    const ids = new Set<string>();
    orderedScheduleIdsForQueries.forEach((_, bucketIdx) => {
      const places = placesQueries[bucketIdx]?.data ?? [];
      for (const place of places) {
        const gid =
          typeof place.googlePlaceId === "string"
            ? place.googlePlaceId.trim()
            : "";
        if (!gid.length) continue;
        ids.add(normalizeGooglePlaceResourceId(gid));
      }
    });
    return ids;
  }, [enabled, rid, orderedScheduleIdsForQueries, placesQueries]);
}
