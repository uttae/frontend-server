"use client";

import { useQueries } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import type { ScheduleItemRouteResponse } from "@/lib/api/rooms";
import {
  useScheduleItemRoute,
  useUpdateScheduleItemTravelMode,
} from "@/hooks/useRooms";
import { persistedScheduleItemRouteQueryOptions } from "@/lib/plan/scheduleItemRoutePersistedQuery";
import { buildScheduleItemRouteSummariesByMode } from "@/lib/plan/scheduleItemRouteModes";
import {
  SCHEDULE_TRAVEL_MODES,
  SCHEDULE_TRAVEL_MODE_DEFAULT,
  canonicalScheduleTravelMode,
  type ScheduleTravelModeValue,
} from "@/lib/plan/scheduleTravelMode";
import { usePlanMobileReadOnly } from "@/hooks/usePlanMobileReadOnly";
import { PLAN_ROUTE_CARD_WIDTH_PX } from "@/lib/layout-tokens";
import { buildGoogleMapsDirectionsUrl } from "@/lib/maps";
import { cn } from "@/lib/utils";
import {
  planMapSegmentEpochStoreKey,
  usePlanMapDirectionsEpochStore,
} from "@/stores/plan-map-directions-epoch-store";

import { PlanTravelTimeCollapsed } from "./PlanTravelTimeCollapsed";
import { TravelDirectionsCard } from "./TravelDirectionsCard";
import { TravelRouteRail } from "./TravelRouteRail";
import { PLAN_SEGMENT_RAIL_LINE_CLASS } from "./travelSegmentRailLayout";

function routePayloadOk(
  r: ScheduleItemRouteResponse | null | undefined,
): r is ScheduleItemRouteResponse {
  return (
    r != null &&
    r.durationSeconds >= 0 &&
    r.distanceMeters >= 0
  );
}

export type PlanTravelTimeProps = {
  roomId: string;
  scheduleId: number;
  segmentSourceItemId: number;
  scheduleFingerprint: string;
  /** 서버 저장 공유 이동수단 (`schedule_items.travel_mode`) — 없으면 기본 `DRIVING` */
  travelMode?: string;
  routeQueryEnabled?: boolean;
  originGooglePlaceId?: string;
  originPlaceName?: string;
  destinationGooglePlaceId?: string;
  destinationPlaceName?: string;
  className?: string;
  /** `PlanTravelSegment` 등 외부 레일 사용 시 카드 본문만 렌더 */
  contentOnly?: boolean;
};

export function PlanTravelTime({
  roomId,
  scheduleId,
  segmentSourceItemId,
  scheduleFingerprint,
  travelMode,
  routeQueryEnabled = true,
  originGooglePlaceId,
  originPlaceName,
  destinationGooglePlaceId,
  destinationPlaceName,
  className,
  contentOnly = false,
}: PlanTravelTimeProps) {
  const { isReadOnly } = usePlanMobileReadOnly();
  const [menuOpen, setMenuOpen] = useState(false);
  const [directionsHidden, setDirectionsHidden] = useState(false);

  const fpTrim = scheduleFingerprint.trim();
  const rid = roomId.trim();
  const mapRouteRenderStatus = usePlanMapDirectionsEpochStore((s) =>
    rid.length > 0
      ? s.routeRenderStatusBySegmentKey[
          planMapSegmentEpochStoreKey(
            rid,
            scheduleId,
            segmentSourceItemId,
          )
        ]
      : undefined,
  );

  /** 서버 저장값 기준 표준 이동수단 — 이 값이 곧 방 전체 공유 상태 */
  const serverMode =
    canonicalScheduleTravelMode(travelMode) ?? SCHEDULE_TRAVEL_MODE_DEFAULT;

  const [selectedMode, setSelectedMode] =
    useState<ScheduleTravelModeValue>(serverMode);

  /** 원격 변경(STOMP → schedule-items 갱신)·본인 PATCH 성공·구간 변경을 선택 상태에 반영 */
  const modeSyncKey = `${rid}:${scheduleId}:${segmentSourceItemId}:${serverMode}`;
  const [prevModeSyncKey, setPrevModeSyncKey] = useState(modeSyncKey);
  if (prevModeSyncKey !== modeSyncKey) {
    setPrevModeSyncKey(modeSyncKey);
    setSelectedMode(serverMode);
  }

  const { mutate: mutateTravelMode } = useUpdateScheduleItemTravelMode();

  const googleMapsDirectionsUrl = buildGoogleMapsDirectionsUrl({
    originPlaceId: originGooglePlaceId ?? "",
    originQuery: originPlaceName ?? "",
    destinationPlaceId: destinationGooglePlaceId ?? "",
    destinationQuery: destinationPlaceName ?? "",
    travelMode: selectedMode,
  });

  const {
    data: selectedRoute,
    isPending: selectedPending,
    isError: selectedError,
    isFetching: selectedFetching,
  } = useScheduleItemRoute(
    roomId,
    scheduleId,
    segmentSourceItemId,
    selectedMode,
    routeQueryEnabled,
    fpTrim,
  );

  const deferredLazyEnabled =
    routeQueryEnabled &&
    menuOpen &&
    rid.length > 0 &&
    Number.isFinite(scheduleId) &&
    Number.isFinite(segmentSourceItemId);

  const menuDeferredModes = useMemo(
    () =>
      SCHEDULE_TRAVEL_MODES.map((m) => m.value).filter(
        (m) => m !== selectedMode,
      ),
    [selectedMode],
  );

  const deferredRouteQueries = useQueries({
    queries: menuDeferredModes.map((mode) =>
      persistedScheduleItemRouteQueryOptions(
        rid,
        scheduleId,
        segmentSourceItemId,
        mode,
        fpTrim,
        {
          segmentReady: routeQueryEnabled,
          networkEnabled: deferredLazyEnabled,
        },
      ),
    ),
  });

  const modeRouteSummaries = useMemo(() => {
    const merged =
      buildScheduleItemRouteSummariesByMode(selectedRoute ?? undefined);

    const apply = (
      payload: ScheduleItemRouteResponse | null | undefined,
    ): void => {
      if (!routePayloadOk(payload)) return;
      const cm = canonicalScheduleTravelMode(
        typeof payload.travelMode === "string"
          ? payload.travelMode.trim()
          : "",
      );
      if (!cm) return;
      merged[cm] = {
        durationSeconds: payload.durationSeconds,
        distanceMeters: payload.distanceMeters,
      };
    };

    apply(selectedRoute);
    menuDeferredModes.forEach((_mode, i) => {
      apply(deferredRouteQueries[i]?.data);
    });

    return merged;
  }, [selectedRoute, menuDeferredModes, deferredRouteQueries]);

  const displayRoute = useMemo(() => {
    const sel = modeRouteSummaries[selectedMode];
    if (
      sel != null &&
      sel.durationSeconds >= 0 &&
      sel.distanceMeters >= 0
    ) {
      return {
        travelMode: selectedMode,
        durationSeconds: sel.durationSeconds,
        distanceMeters: sel.distanceMeters,
      } satisfies ScheduleItemRouteResponse;
    }
    if (routePayloadOk(selectedRoute)) {
      const rc = canonicalScheduleTravelMode(
        typeof selectedRoute.travelMode === "string"
          ? selectedRoute.travelMode.trim()
          : "",
      );
      if (rc === selectedMode) return selectedRoute;
    }
    return undefined;
  }, [modeRouteSummaries, selectedMode, selectedRoute]);

  const modeRouteRowLoading = useMemo(() => {
    const out: Partial<Record<ScheduleTravelModeValue, boolean>> = {};
    const hasSummary = (m: ScheduleTravelModeValue) => {
      const s = modeRouteSummaries[m];
      return (
        s != null &&
        s.durationSeconds >= 0 &&
        s.distanceMeters >= 0
      );
    };
    if (routeQueryEnabled) {
      out[selectedMode] =
        !hasSummary(selectedMode) && (selectedPending || selectedFetching);
      menuDeferredModes.forEach((mode, i) => {
        const q = deferredRouteQueries[i];
        out[mode] =
          deferredLazyEnabled &&
          !hasSummary(mode) &&
          Boolean(q?.isPending || q?.isFetching);
      });
    }
    return out;
  }, [
    modeRouteSummaries,
    routeQueryEnabled,
    selectedMode,
    deferredLazyEnabled,
    selectedPending,
    selectedFetching,
    menuDeferredModes,
    deferredRouteQueries,
  ]);

  const primarySettled = !selectedPending && !selectedFetching;

  const summaryFetching = !displayRoute && selectedFetching;

  const summaryPending =
    !displayRoute && !selectedFetching && selectedPending;

  const summaryIsError =
    !displayRoute && primarySettled && selectedError;

  const summaryUnavailable =
    !displayRoute &&
    primarySettled &&
    !summaryIsError;

  const handleSelectTravelMode = useCallback(
    (mode: ScheduleTravelModeValue) => {
      setMenuOpen(false);
      if (mode === selectedMode) return;
      /** 낙관적 반영 — 실패 시 선택 시점의 서버 저장값으로 복귀 */
      const revertTo = serverMode;
      setSelectedMode(mode);
      mutateTravelMode(
        {
          roomId: rid,
          scheduleId,
          itemId: segmentSourceItemId,
          travelMode: mode,
        },
        {
          onError: () => {
            setSelectedMode(revertTo);
            toast.error("이동 수단을 변경하지 못했어요.");
          },
        },
      );
    },
    [
      rid,
      scheduleId,
      segmentSourceItemId,
      selectedMode,
      serverMode,
      mutateTravelMode,
    ],
  );

  if (directionsHidden) {
    return (
      <PlanTravelTimeCollapsed
        className={className}
        contentOnly={contentOnly}
        onShowDirections={() => setDirectionsHidden(false)}
      />
    );
  }

  const directionsCard = (
    <div
      className={cn(
        "flex shrink-0 flex-col justify-center",
        !contentOnly && "py-0.5",
        isReadOnly && "min-w-0 max-w-full flex-1",
        contentOnly && "w-full max-w-full",
      )}
      style={
        isReadOnly || contentOnly ?
          undefined
        : { width: PLAN_ROUTE_CARD_WIDTH_PX }
      }
    >
      <TravelDirectionsCard
          menuOpen={menuOpen}
          onToggleMenu={() => setMenuOpen((o) => !o)}
          summaryMode={selectedMode}
          route={displayRoute}
          routeQuery={{
            isPending: summaryPending,
            isError: summaryIsError,
            isFetching: summaryFetching,
          }}
          routeUnavailable={summaryUnavailable}
          modeRouteSummaries={modeRouteSummaries}
          modeRouteRowLoading={modeRouteRowLoading}
          effectiveMode={selectedMode}
          showUnknownOption={false}
          modeRaw=""
          renderWarning={
            mapRouteRenderStatus === "unavailable"
              ? "해당 경로는 렌더링할 수 없어요."
              : undefined
          }
          googleMapsDirectionsUrl={googleMapsDirectionsUrl ?? undefined}
          onSelectTravelMode={handleSelectTravelMode}
          onHideDirections={() => {
            setDirectionsHidden(true);
            setMenuOpen(false);
          }}
        />
    </div>
  );

  if (contentOnly) {
    return (
      <div
        className={cn(className)}
        role="separator"
        aria-label="이동 시간 및 길찾기"
      >
        {directionsCard}
      </div>
    );
  }

  return (
    <div
      className={cn("relative py-1 pl-1", className)}
      role="separator"
      aria-label="이동 시간 및 길찾기"
    >
      <div className={PLAN_SEGMENT_RAIL_LINE_CLASS} aria-hidden />
      <div className="relative flex min-h-10 items-center gap-3">
        <TravelRouteRail arrowClassName="text-primary" layout="row" />
        {directionsCard}
      </div>
    </div>
  );
}
