"use client";

import { useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PlanLoadingSkeleton } from "../PlanLoadingSkeleton";

import { PlusIcon } from "@/assets/icons";
import { DashedPlaceholderBox } from "@/components/mobile/DashedPlaceholderBox";
import { useExpenseContext } from "@/components/expenses/ExpenseProvider";
import { usePrefetchScheduleRoutes } from "@/hooks/usePrefetchScheduleRoutes";
import {
  useRoomSchedules,
  useScheduleItemMoveSavingDays,
  useSchedulePlanPlaces,
} from "@/hooks/useRooms";
import { expensesInScope } from "@/lib/expenses/expense-scope";
import { buildMapRouteHref } from "@/lib/mobile-view";
import type { InsertAnchor } from "@/lib/plan/insertPosition";
import { summarizePlaceExpenses } from "@/lib/plan/mobilePlanFormat";
import { planCopy } from "@/lib/plan/planCopy";
import { schedulePlacesFingerprint } from "@/lib/plan/planTravelLocalStorage";
import {
  scheduleIdsToRouteColors,
  sortedScheduleIdsForRouteColors,
} from "@/lib/plan/planRouteDayColors";
import { sortRoomSchedules } from "@/lib/plan/scheduleMerge";
import type { PlanPlace } from "@/lib/plan/types";
import { cn } from "@/lib/utils";
import { usePlanScheduleRouteVisibilityStore } from "@/stores/plan-schedule-route-visibility-store";

import { PlanTravelTime } from "../travel-time/PlanTravelTime";
import { TravelRouteRail } from "../travel-time/TravelRouteRail";
import { MobilePlanPlaceCard } from "./MobilePlanPlaceCard";
import { MobilePlanPlaceSheets, openPlaceExpenses, type MobilePlanPlaceSheet } from "./MobilePlanPlaceSheets";
import { useMobilePlanDrag } from "./mobilePlanDrag";

const EMPTY_PLACES: PlanPlace[] = [];

type MobilePlanItineraryProps = Readonly<{
  roomId: string;
  scheduleId: number;
  monthDayLabel?: string;
  onRequestAddPlace: (anchor: InsertAnchor | null) => void;
  recentlyAddedItemId: number | null;
  onPlaceAdded: (itemId: number) => void;
}>;

export function MobilePlanItinerary({
  roomId,
  scheduleId,
  monthDayLabel,
  onRequestAddPlace,
  recentlyAddedItemId,
  onPlaceAdded,
}: MobilePlanItineraryProps) {
  const expenses = useExpenseContext();
  const router = useRouter();
  const { data: schedules } = useRoomSchedules(roomId);
  const { data, isLoading, isFetching, isError } = useSchedulePlanPlaces(roomId, scheduleId);
  const places = data ?? EMPTY_PLACES;
  const drag = useMobilePlanDrag();
  const { editing, registerPlaces } = drag;
  useEffect(() => {
    registerPlaces(scheduleId, places);
  }, [places, registerPlaces, scheduleId]);

  const visibleByScheduleId = usePlanScheduleRouteVisibilityStore((s) => s.visibleByScheduleId);
  const badgeColor = useMemo(
    () =>
      scheduleIdsToRouteColors(sortedScheduleIdsForRouteColors(visibleByScheduleId)).get(scheduleId) ?? "#f12d33",
    [scheduleId, visibleByScheduleId],
  );

  const scheduleFingerprint = useMemo(() => schedulePlacesFingerprint(places), [places]);
  const routesBatchSettled = usePrefetchScheduleRoutes(
    roomId,
    scheduleId,
    places,
    !isLoading && !isFetching && !isError && places.length >= 2 && scheduleFingerprint.length > 0,
  );
  const isSavingPlaceMove = useScheduleItemMoveSavingDays(roomId).includes(scheduleId);
  const existingItemIds = useMemo(
    () => new Set(places.map((p) => p.itemId).filter((id): id is number => typeof id === "number")),
    [places],
  );

  const [sheet, setSheet] = useState<MobilePlanPlaceSheet | null>(null);

  const itemExpenses = useCallback(
    (itemId: number | undefined) =>
      typeof itemId === "number"
        ? expensesInScope(expenses.list.data ?? [], { scheduleId, scheduleItemId: itemId, label: "" })
        : [],
    [expenses.list.data, scheduleId],
  );

  function openPlace(place: PlanPlace) {
    const dayNumber = sortRoomSchedules(schedules ?? []).findIndex((s) => s.scheduleId === scheduleId) + 1;
    router.push(buildMapRouteHref(Math.max(dayNumber, 1), place.itemId));
  }

  const listRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const scrolledItemIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (recentlyAddedItemId === null || scrolledItemIdRef.current === recentlyAddedItemId) return;
    const row = listRef.current?.querySelector(`[data-plan-item-id="${recentlyAddedItemId}"]`);
    if (!row) return;
    scrolledItemIdRef.current = recentlyAddedItemId;
    row.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion ? "auto" : "smooth" });
  }, [places, prefersReducedMotion, recentlyAddedItemId]);

  return (
    <div className="flex flex-col">
      <PlanPlaceStatus isLoading={isLoading} isError={isError} />

      <div
        ref={(el) => {
          listRef.current = el;
          drag.registerList(scheduleId, el);
        }}
        className={editing ? "flex flex-col gap-2" : "flex flex-col"}
      >
        {places.length === 0 && !isLoading && !isError ? (
          <EmptyDayDropZone active={drag.dropTargetScheduleId === scheduleId} />
        ) : null}
        {places.map((place, index) => {
          const next = places[index + 1];
          return (
            <div
              key={place.id}
              data-plan-item-id={place.itemId}
              ref={(el) => drag.registerRow(scheduleId, index, el)}
              style={drag.rowStyle(scheduleId, index, places)}
            >
              <MobilePlanPlaceCard
                place={place}
                orderNumber={index + 1}
                badgeColor={badgeColor}
                highlighted={recentlyAddedItemId !== null && place.itemId === recentlyAddedItemId}
                expenseSummary={summarizePlaceExpenses(itemExpenses(place.itemId))}
                onOpen={() => openPlace(place)}
                onOpenActions={() => setSheet({ kind: "actions", place })}
                onOpenExpenses={() => openPlaceExpenses(expenses, scheduleId, place)}
                onEditMemo={() => setSheet({ kind: "memo", place })}
                onEditTime={() => setSheet({ kind: "time", place })}
                editing={editing}
                dragDisabled={typeof place.itemId !== "number"}
                onHandlePointerDown={(e) => drag.startDrag(scheduleId, index, e)}
              />
              <PlaceTravelSegment
                place={place}
                next={next}
                editing={editing}
                roomId={roomId}
                scheduleId={scheduleId}
                scheduleFingerprint={scheduleFingerprint}
                routesReady={data !== undefined && !isFetching && !isSavingPlaceMove && routesBatchSettled}
                existingItemIds={existingItemIds}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onRequestAddPlace(null)}
          className="flex items-center justify-center rounded-lg border border-border-subtle bg-fill-subtle px-3.5 py-3"
        >
          <PlusIcon size={20} className="text-icon-subtle" />
          <span className="px-1.5 text-label-l-emphasis text-text-subtle">장소 추가</span>
        </button>
        <button
          type="button"
          onClick={() => setSheet({ kind: "bookmark", anchor: null })}
          className="flex items-center justify-center rounded-lg border border-border-subtle bg-fill-subtle px-3.5 py-3"
        >
          <span className="px-1.5 text-label-l-emphasis text-text-subtle">북마크에서 추가</span>
        </button>
      </div>

      <MobilePlanPlaceSheets
        roomId={roomId}
        scheduleId={scheduleId}
        places={places}
        monthDayLabel={monthDayLabel}
        sheet={sheet}
        onChangeSheet={setSheet}
        canInsert={!editing}
        onInsertFromSearch={(anchor) => onRequestAddPlace(anchor)}
        onPlaceAdded={onPlaceAdded}
      />
    </div>
  );
}

function PlaceTravelSegment({
  place,
  next,
  editing,
  roomId,
  scheduleId,
  scheduleFingerprint,
  routesReady,
  existingItemIds,
}: Readonly<{
  place: PlanPlace;
  next?: PlanPlace;
  editing: boolean;
  roomId: string;
  scheduleId: number;
  scheduleFingerprint: string;
  routesReady: boolean;
  existingItemIds: ReadonlySet<number>;
}>) {
  if (editing || !next) return null;
  if (typeof place.itemId !== "number" || typeof next.itemId !== "number") {
    return <div className="h-2" />;
  }
  return (
    <div className="flex gap-2 py-1 pr-3">
      <TravelRouteRail />
      <PlanTravelTime
        contentOnly
        className="flex min-h-10 min-w-0 flex-1 items-center"
        roomId={roomId}
        scheduleId={scheduleId}
        segmentSourceItemId={place.itemId}
        destinationItemId={next.itemId}
        scheduleFingerprint={scheduleFingerprint}
        travelMode={place.travelMode}
        originGooglePlaceId={place.googlePlaceId}
        originPlaceName={place.title}
        destinationGooglePlaceId={next.googlePlaceId}
        destinationPlaceName={next.title}
        routeQueryEnabled={
          routesReady && existingItemIds.has(place.itemId) && existingItemIds.has(next.itemId)
        }
      />
    </div>
  );
}

function PlanPlaceStatus({ isLoading, isError }: Readonly<{ isLoading: boolean; isError: boolean }>) {
  return (
    <>
      {isLoading ? (
        <PlanLoadingSkeleton places />
      ) : null}
      {isError ? (
        <p className="py-4 text-center text-body-s-regular text-status-negative">
          장소 목록을 불러오지 못했어요.
        </p>
      ) : null}
    </>
  );
}

function EmptyDayDropZone({ active }: Readonly<{ active: boolean }>) {
  return (
    <DashedPlaceholderBox
      active={active}
      className={cn("h-14 text-body-s-regular", active ? "text-primary" : "text-text-subtle")}
    >
      {active ? "여기에 놓기" : planCopy.placesEmpty}
    </DashedPlaceholderBox>
  );
}
