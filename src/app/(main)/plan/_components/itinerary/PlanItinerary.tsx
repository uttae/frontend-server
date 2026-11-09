"use client";
import { Spinner } from "@/components/ui/spinner";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PlanLoadingSkeleton } from "../PlanLoadingSkeleton";
import { toast } from "sonner";

import {
  useCreateScheduleItem,
  useScheduleItemMoveSavingDays,
  useSchedulePlanPlaces,
} from "@/hooks/useRooms";
import { AnalyticsEvents, trackAnalyticsEvent } from "@/lib/analytics/track";
import { bucketItemCount } from "@/lib/analytics/context";
import { usePrefetchScheduleRoutes } from "@/hooks/usePrefetchScheduleRoutes";
import { usePlanItemDrag } from "@/hooks/usePlanItemDragController";
import { useMapCenterStore } from "@/stores/map-center-store";
import { schedulePlacesFingerprint } from "@/lib/plan/planTravelLocalStorage";
import {
  scheduleIdsToRouteColors,
  sortedScheduleIdsForRouteColors,
} from "@/lib/plan/planRouteDayColors";
import { usePlanScheduleRouteVisibilityStore } from "@/stores/plan-schedule-route-visibility-store";
import { cn } from "@/lib/utils";

import type { PlanPlace } from "@/lib/plan/types";

import { planCopy } from "@/lib/plan/planCopy";
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

  // 장소 이동을 저장하는 동안 캐시는 새 순서지만 서버는 아직 옛 순서다 — 지금 새 구간 경로를 받으면
  // 옛 이웃까지의 경로가 새 구간 key에 남는다. 저장이 끝나면(다시 받은 목록으로) 조회한다
  const isSavingPlaceMove = useScheduleItemMoveSavingDays(roomId).includes(scheduleId);

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

  const { dropZoneProps, isItemDragActive, reservePaddingBottom, getRowProps } =
    usePlanItemDrag().getListProps(scheduleId, places);

  useEffect(() => {
    if (activeInsertIndex === null) return;

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
  }, [activeInsertIndex]);

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
          room_id: roomId,
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

  const addControlsDisabled = isAdding;

  return (
    <div
      {...dropZoneProps}
      className={cn(
        !isLoading &&
          places.length === 0 &&
          isItemDragActive &&
          "min-h-12",
      )}
    >
      {isLoading ?
        <PlanLoadingSkeleton places />
      : null}

      {isError ?
        <p className="py-4 text-center text-body-m-regular mobile:text-body-s-regular text-primary">
          장소 목록을 불러오지 못했어요.
        </p>
      : null}

      {!isLoading && places.length === 0 ?
        <p className="py-4 text-center text-body-m-regular mobile:text-body-s-regular text-dark-gray">
          {planCopy.placesEmpty}
        </p>
      : null}

      <div
        className="flex flex-col gap-0"
        style={
          reservePaddingBottom > 0
            ? { paddingBottom: reservePaddingBottom }
            : undefined
        }
      >
        {places.map((place, index) => {
          const { ref, style, placeCardDragProps } = getRowProps(index);
          const insertIndex = index + 1;
          const segmentActive = activeInsertIndex === insertIndex;
          const nextItemId = places[index + 1]?.itemId;

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
              typeof nextItemId === "number" ?
                <PlanTravelSegment
                  isActive={segmentActive}
                  onActivate={() =>
                    setActiveInsertIndex((current) =>
                      current === insertIndex ? null : insertIndex,
                    )
                  }
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
                    // 구간 줄을 카드 폭만큼 채워 Google 길찾기를 오른쪽 끝에 둔다
                    className="w-full"
                    roomId={roomId}
                    scheduleId={scheduleId}
                    segmentSourceItemId={place.itemId}
                    destinationItemId={nextItemId}
                    scheduleFingerprint={scheduleFingerprint}
                    travelMode={place.travelMode}
                    originGooglePlaceId={place.googlePlaceId}
                    originPlaceName={place.title}
                    destinationGooglePlaceId={places[index + 1].googlePlaceId}
                    destinationPlaceName={places[index + 1].title}
                    routeQueryEnabled={
                      placesData !== undefined &&
                      !isFetchingPlaces &&
                      !isSavingPlaceMove &&
                      routesBatchSettled &&
                      existingItemIds.has(place.itemId) &&
                      existingItemIds.has(nextItemId)
                    }
                  />
                </PlanTravelSegment>
              : null}
            </PlanItineraryReorderRow>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-dashed border-gray-border pt-4">
        <PlanAddPlaceControls
          coords={mapCenter}
          disabled={addControlsDisabled}
          onPickPrediction={(p) => void handlePickPrediction(p)}
          onOpenBookmark={() => setBookmarkModal({})}
        />
        {isAdding ?
          <Spinner aria-label="장소 추가 중" />
        : null}
      </div>

      {bookmarkModal ?
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
