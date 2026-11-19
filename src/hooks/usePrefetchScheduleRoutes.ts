import { useLayoutEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { fetchAndSeedScheduleRoutesBatch } from "@/lib/plan/schedule-bulk-hydration";
import { schedulePlacesFingerprint } from "@/lib/plan/planTravelLocalStorage";
import type { PlanPlace } from "@/lib/plan/types";

export function usePrefetchScheduleRoutes(
  roomId: string,
  scheduleId: number,
  places: readonly PlanPlace[],
  enabled: boolean,
): boolean {
  const queryClient = useQueryClient();
  const [completedKeys, setCompletedKeys] = useState<ReadonlySet<string>>(() => new Set());

  const scheduleKey = `${roomId.trim()}:${scheduleId}`;

  const fingerprint = useMemo(
    () => schedulePlacesFingerprint([...places]),
    [places],
  );

  useLayoutEffect(() => {
    if (!enabled || !roomId.trim() || places.length < 2 || !fingerprint.length) {
      return;
    }

    if (completedKeys.has(scheduleKey)) {
      return;
    }

    let cancelled = false;

    void fetchAndSeedScheduleRoutesBatch(
      queryClient,
      roomId,
      scheduleId,
      places,
    ).finally(() => {
      if (!cancelled) {
        setCompletedKeys((keys) => new Set(keys).add(scheduleKey));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [completedKeys, enabled, fingerprint, places, queryClient, roomId, scheduleId, scheduleKey]);

  return !enabled || (places.length >= 2 && fingerprint.length > 0 && completedKeys.has(scheduleKey));
}
