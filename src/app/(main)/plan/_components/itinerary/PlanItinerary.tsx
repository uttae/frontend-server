"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  useCreateScheduleItem,
  useSchedulePlanPlaces,
} from "@/hooks/useRooms";
import { AnalyticsEvents, trackAnalyticsEvent } from "@/lib/analytics/track";
import { bucketItemCount } from "@/lib/analytics/context";
import { usePrefetchScheduleRoutes } from "@/hooks/usePrefetchScheduleRoutes";
import { usePlanItineraryReorder } from "@/hooks/usePlanItineraryReorder";
import { PLAN_ITEM_ITINERARY_DROP_ZONE_ATTR } from "@/lib/plan/planItemReorder";
import { useMapCenterStore } from "@/stores/map-center-store";
import { schedulePlacesFingerprint } from "@/lib/plan/planTravelLocalStorage";
import {
  scheduleIdsToRouteColors,
  sortedScheduleIdsForRouteColors,
} from "@/lib/plan/planRouteDayColors";
import { usePlanItemCrossDayDragStore } from "@/stores/plan-item-cross-day-drag-store";
import { usePlanScheduleRouteVisibilityStore } from "@/stores/plan-schedule-route-visibility-store";
import { cn } from "@/lib/utils";

import type { PlanPlace } from "@/lib/plan/types";

import { usePlanMobileReadOnly } from "@/hooks/usePlanMobileReadOnly";
import { PlanTravelTime } from "../travel-time/PlanTravelTime";
import { AddFromBookmarkModal } from "./AddFromBookmarkModal";
import { PlanAddPlaceControls } from "./PlanAddPlaceControls";
import { PlanItineraryReorderRow } from "./PlanItineraryReorderRow";
import { PlanPlaceCard } from "./PlanPlaceCard";
import { PlanTravelSegment } from "./PlanTravelSegment";

const EMPTY_PLAN_PLACES: PlanPlace[] = [];

export type PlanItineraryProps = {
  roomId: string;
  scheduleId: number;
};

export function PlanItinerary({ roomId, scheduleId }: PlanItineraryProps) {
  const { isReadOnly, copy } = usePlanMobileReadOnly();
  const mapCenter = useMapCenterStore((s) => s.mapCenter);
  const visibleByScheduleId = usePlanScheduleRouteVisibilityStore(
    (s) => s.visibleByScheduleId,
  );
  const routeColorByScheduleId = useMemo(
    () =>
      scheduleIdsToRouteColors(
        sortedScheduleIdsForRouteColors(visibleByScheduleId),
        roomId.trim() || undefined,
      ),
    [visibleByScheduleId, roomId],
  );
  const orderBadgeColor =
    routeColorByScheduleId.get(scheduleId) ?? "#f12d33";

  const {
    data: placesData,
    isLoading,
    isFetching: isFetchingPlaces,
    isError,
  } = useSchedulePlanPlaces(roomId, scheduleId);

  const places = placesData ?? EMPTY_PLAN_PLACES;

  const scheduleFingerprint = useMemo(
    () => schedulePlacesFingerprint(places),
    [places],
  );

  const routeQueryEnabled =
    !isLoading &&
    !isFetchingPlaces &&
    !isError &&
    places.length >= 2 &&
    scheduleFingerprint.length > 0;

  const routesBatchSettled = usePrefetchScheduleRoutes(
    roomId,
    scheduleId,
    places,
    routeQueryEnabled,
  );

  const existingItemIds = useMemo(
    () =>
      new Set(
        places
          .map((p) => p.itemId)
          .filter((id): id is number => typeof id === "number"),
      ),
    [places],
  );
  const { mutateAsync: createItem, isPending: isAdding } =
    useCreateScheduleItem();

  const [activeInsertIndex, setActiveInsertIndex] = useState<number | null>(
    null,
  );
  const [bookmarkModal, setBookmarkModal] = useState<{
    insertIndex?: number;
  } | null>(null);

  const prefersReducedMotion = useReducedMotion();

  const {
    getRowProps,
    listContainerProps,
    isDraggingActive,
    listReservePaddingBottom,
  } = usePlanItineraryReorder({
    roomId,
    scheduleId,
    places,
    interactionLocked:
      isAdding || isReadOnly || activeInsertIndex !== null,
  });

  useEffect(() => {
    if (activeInsertIndex === null || isReadOnly) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (target instanceof Element) {
        if (target.closest("[data-plan-insert-slot]")) return;
        if (target.closest("[data-places-autocomplete-menu]")) return;
      }
      setActiveInsertIndex(null);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [activeInsertIndex, isReadOnly]);

  const handlePickPrediction = useCallback(
    async (
      prediction: google.maps.places.PlacePrediction,
      insertIndex?: number,
    ) => {
      const googlePlaceId = prediction.placeId;
      if (!googlePlaceId) {
        toast.error("장소 식별 정보를 찾을 수 없어요.");
        return;
      }
      const index = insertIndex ?? places.length;
      try {
        await createItem({
          roomId,
          scheduleId,
          googlePlaceId,
          insertIndex: index,
          placesSnapshot: places,
        });
        trackAnalyticsEvent(AnalyticsEvents.addToItinerary, {
          item_count_bucket: bucketItemCount(places.length + 1),
          interaction_source: "search",
        });
        setActiveInsertIndex(null);
      } catch {
        toast.error("장소를 일정에 추가하지 못했어요.");
      }
    },
    [createItem, places, roomId, scheduleId],
  );

  const addControlsDisabled = isAdding || isReadOnly;

  const crossDayItemDragActive = usePlanItemCrossDayDragStore(
    (s) => s.sourceScheduleId !== null,
  );

  return (
    <div
      {...listContainerProps}
      {...{ [PLAN_ITEM_ITINERARY_DROP_ZONE_ATTR]: "" }}
      className={cn(
        !isLoading &&
          places.length === 0 &&
          crossDayItemDragActive &&
          "min-h-12",
      )}
    >
      {isLoading ?
        <div className="flex items-center justify-center gap-2 py-8 text-dark-gray">
          <Loader2 className="h-5 w-5 animate-spin text-primary-strong" />
          <span className="text-[17px]">장소 목록을 불러오는 중…</span>
        </div>
      : null}

      {isError ?
        <p className="py-4 text-center text-[17px] text-primary">
          장소 목록을 불러오지 못했어요.
        </p>
      : null}

      {!isLoading && places.length === 0 ?
        <p className="py-4 text-center text-[17px] text-dark-gray">
          {copy.placesEmpty}
        </p>
      : null}

      <div
        className="flex flex-col gap-0"
        style={
          listReservePaddingBottom > 0
            ? { paddingBottom: listReservePaddingBottom }
            : undefined
        }
      >
        {places.map((place, index) => {
          const motionEnabled = isDraggingActive && !prefersReducedMotion;
          const { ref, style, placeCardDragProps } = getRowProps(
            index,
            motionEnabled,
          );
          const insertIndex = index + 1;
          const segmentActive = activeInsertIndex === insertIndex;

          return (
            <PlanItineraryReorderRow
              key={place.id}
              rowRef={ref}
              style={style}
            >
              <PlanPlaceCard
                place={place}
                itineraryItemCount={places.length}
                orderBadgeColor={orderBadgeColor}
                scheduleTimeEdit={{ roomId, scheduleId }}
                {...placeCardDragProps}
              />
              {index < places.length - 1 &&
              typeof place.itemId === "number" &&
              typeof places[index + 1]?.itemId === "number" ?
                <PlanTravelSegment
                  isActive={segmentActive}
                  onActivate={() => setActiveInsertIndex(insertIndex)}
                  addDisabled={addControlsDisabled}
                  showAddControls={segmentActive}
                  addControls={
                    <PlanAddPlaceControls
                      coords={mapCenter}
                      disabled={addControlsDisabled}
                      onPickPrediction={(p) =>
                        void handlePickPrediction(p, insertIndex)
                      }
                      onOpenBookmark={() =>
                        setBookmarkModal({ insertIndex })
                      }
                    />
                  }
                >
                  <PlanTravelTime
                    contentOnly
                    roomId={roomId}
                    scheduleId={scheduleId}
                    segmentSourceItemId={place.itemId}
                    scheduleFingerprint={scheduleFingerprint}
                    travelMode={place.travelMode}
                    originGooglePlaceId={place.googlePlaceId}
                    originPlaceName={place.title}
                    destinationGooglePlaceId={places[index + 1].googlePlaceId}
                    destinationPlaceName={places[index + 1].title}
                    routeQueryEnabled={
                      placesData !== undefined &&
                      !isFetchingPlaces &&
                      routesBatchSettled &&
                      existingItemIds.has(place.itemId) &&
                      existingItemIds.has(places[index + 1].itemId!)
                    }
                  />
                </PlanTravelSegment>
              : null}
            </PlanItineraryReorderRow>
          );
        })}
      </div>

      {!isReadOnly ?
        <div className="mt-4 flex flex-col gap-2 border-t border-dashed border-gray-border pt-4">
          <PlanAddPlaceControls
            coords={mapCenter}
            disabled={addControlsDisabled}
            onPickPrediction={(p) => void handlePickPrediction(p)}
            onOpenBookmark={() => setBookmarkModal({})}
          />
          {isAdding ?
            <p className="text-[14px] text-dark-gray">추가하는 중…</p>
          : null}
        </div>
      : null}

      {bookmarkModal && !isReadOnly ?
        <AddFromBookmarkModal
          roomId={roomId}
          scheduleId={scheduleId}
          places={places}
          insertIndex={bookmarkModal.insertIndex}
          onClose={() => {
            setBookmarkModal(null);
            setActiveInsertIndex(null);
          }}
        />
      : null}
    </div>
  );
}
