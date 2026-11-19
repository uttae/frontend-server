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
  canonicalScheduleTravelMode,
  type ScheduleTravelModeValue,
} from "@/lib/plan/scheduleTravelMode";
import { useMobileView } from "@/contexts/MobileViewContext";
import { PLAN_ROUTE_CARD_WIDTH_PX } from "@/lib/layout-tokens";
import { buildGoogleMapsDirectionsUrl } from "@/lib/maps";
import { cn } from "@/lib/utils";

import { PlanTravelTimeCollapsed } from "./PlanTravelTimeCollapsed";
import { TravelDirectionsCard } from "./TravelDirectionsCard";
import { TravelRouteRail } from "./TravelRouteRail";

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
  destinationItemId: number;
  scheduleFingerprint: string;
  travelMode?: string;
  routeQueryEnabled?: boolean;
  originGooglePlaceId?: string;
  originPlaceName?: string;
  destinationGooglePlaceId?: string;
  destinationPlaceName?: string;
  className?: string;
  contentOnly?: boolean;
};

export function PlanTravelTime({
  roomId,
  scheduleId,
  segmentSourceItemId,
  destinationItemId,
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
  const { isMobileDevice } = useMobileView();
  const [menuOpen, setMenuOpen] = useState(false);
  const [directionsHidden, setDirectionsHidden] = useState(false);

  const fpTrim = scheduleFingerprint.trim();
  const rid = roomId.trim();
  const serverMode =
    canonicalScheduleTravelMode(travelMode);

  const {
    mutate: mutateTravelMode,
    variables: pendingTravelMode,
    isPending: isTravelModePending,
  } = useUpdateScheduleItemTravelMode();
  const selectedMode =
    isTravelModePending && pendingTravelMode?.itemId === segmentSourceItemId
      ? pendingTravelMode.travelMode
      : serverMode;

  const googleMapsDirectionsUrl = selectedMode === null ? null : buildGoogleMapsDirectionsUrl({
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
    destinationItemId,
    selectedMode,
    routeQueryEnabled,
    fpTrim,
  );

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
        destinationItemId,
        mode,
        fpTrim,
        {
          segmentReady: routeQueryEnabled,
          networkEnabled: false,
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
    if (selectedMode === null) return undefined;
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
    if (routeQueryEnabled && selectedMode !== null) {
      out[selectedMode] =
        !hasSummary(selectedMode) && (selectedPending || selectedFetching);
    }
    return out;
  }, [
    modeRouteSummaries,
    routeQueryEnabled,
    selectedMode,
    selectedPending,
    selectedFetching,
  ]);

  const primarySettled = !selectedPending && !selectedFetching;

  const summaryFetching = !displayRoute && selectedFetching;

  const summaryPending =
    selectedMode !== null && !displayRoute && !selectedFetching && selectedPending;

  const summaryIsError =
    !displayRoute && primarySettled && selectedError && selectedRoute !== null;

  const summaryUnavailable =
    !displayRoute &&
    primarySettled &&
    !summaryIsError;

  const handleSelectTravelMode = useCallback(
    (mode: ScheduleTravelModeValue) => {
      setMenuOpen(false);
      if (mode === selectedMode) return;
      mutateTravelMode(
        {
          roomId: rid,
          scheduleId,
          itemId: segmentSourceItemId,
          travelMode: mode,
        },
        {
          onError: () => {
            toast.error("이동 수단을 변경하지 못했어요.");
          },
        },
      );
    },
    [rid, scheduleId, segmentSourceItemId, selectedMode, mutateTravelMode],
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
        isMobileDevice && "min-w-0 max-w-full flex-1",
        contentOnly && "w-full max-w-full",
      )}
      style={
        isMobileDevice || contentOnly ?
          undefined
        : { width: PLAN_ROUTE_CARD_WIDTH_PX }
      }
    >
      <TravelDirectionsCard
          menuOpen={menuOpen}
          onToggleMenu={() => setMenuOpen((o) => !o)}
          summaryMode={selectedMode ?? ""}
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
          googleMapsDirectionsUrl={googleMapsDirectionsUrl ?? undefined}
          variant={isMobileDevice ? "mobile" : "web"}
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
      <div className="relative flex min-h-10 items-center gap-3">
        <TravelRouteRail />
        {directionsCard}
      </div>
    </div>
  );
}
