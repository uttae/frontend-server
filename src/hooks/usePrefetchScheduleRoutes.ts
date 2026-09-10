import { useLayoutEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { fetchAndSeedScheduleRoutesBatch } from "@/lib/plan/schedule-bulk-hydration";
import { schedulePlacesFingerprint } from "@/lib/plan/planTravelLocalStorage";
import type { PlanPlace } from "@/lib/plan/types";

/**
 * 페이지 진입·새로고침 시 일차별 구간 경로를 저장된 공유 이동수단 기준 `routes/batch`로 1회 시딩합니다.
 * 리오더·추가·삭제 등으로 장소 목록이 바뀌면 batch는 재호출하지 않고, 무효화된 구간만 개별 GET합니다.
 */
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

  /** enabled 전환 직후 이전 true 잔존으로 GET이 먼저 나가지 않도록 — batch 완료 전엔 false */
  return !enabled || (places.length >= 2 && fingerprint.length > 0 && completedKeys.has(scheduleKey));
}
