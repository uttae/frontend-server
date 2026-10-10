"use client";

import { useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PlanLoadingSkeleton } from "../PlanLoadingSkeleton";

import { PlusIcon } from "@/assets/icons";
import { DashedPlaceholderBox } from "@/components/mobile/DashedPlaceholderBox";
import { useExpenseContext } from "@/components/expenses/ExpenseProvider";
import { usePrefetchScheduleRoutes } from "@/hooks/usePrefetchScheduleRoutes";
import { useRoomSchedules, useSchedulePlanPlaces } from "@/hooks/useRooms";
import { expensesInScope } from "@/lib/expenses/expense-scope";
import { buildMapRouteHref } from "@/lib/mobile-view";
import type { InsertAnchor } from "@/lib/plan/insertPosition";
import { summarizeExpensesForMobile } from "@/lib/plan/mobilePlanFormat";
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
import { MobilePlanPlaceCard } from "./MobilePlanPlaceCard";
import { MobilePlanPlaceSheets, openPlaceExpenses, type MobilePlanPlaceSheet } from "./MobilePlanPlaceSheets";
import { applyPendingPlanMove, useMobilePlanDrag } from "./mobilePlanDrag";

const EMPTY_PLACES: PlanPlace[] = [];

type MobilePlanItineraryProps = Readonly<{
  roomId: string;
  scheduleId: number;
  /** `9월 21일` — 방문 시간 시트에 표시 */
  monthDayLabel?: string;
  /** 전체 화면 검색으로 이 일차에 장소 추가 — anchor 자리에, null이면 맨 뒤. 탭 제스처 안에서 호출해야 한다 */
  onRequestAddPlace: (anchor: InsertAnchor | null) => void;
  /** 방금 추가한 장소 — 이 일차에 있으면 카드로 스크롤하고 강조한다(해제는 상위에서) */
  recentlyAddedItemId: number | null;
  onPlaceAdded: (itemId: number) => void;
}>;

/** 모바일 일차별 장소 목록 — 카드·이동 요약·추가 버튼, 편집 모드에서는 핸들로 순서를 바꾼다(다른 일차로도) */
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
  const serverPlaces = data ?? EMPTY_PLACES;
  const drag = useMobilePlanDrag();
  const { editing, registerPlaces } = drag;
  // 옮긴 결과를 서버 반영 전까지 먼저 보여준다
  const places = useMemo(
    () => applyPendingPlanMove(scheduleId, serverPlaces, drag.pending),
    [drag.pending, scheduleId, serverPlaces],
  );
  useEffect(() => {
    registerPlaces(scheduleId, places);
  }, [places, registerPlaces, scheduleId]);

  const visibleByScheduleId = usePlanScheduleRouteVisibilityStore((s) => s.visibleByScheduleId);
  const badgeColor = useMemo(
    () =>
      scheduleIdsToRouteColors(
        sortedScheduleIdsForRouteColors(visibleByScheduleId),
        roomId.trim() || undefined,
      ).get(scheduleId) ?? "#f12d33",
    [roomId, scheduleId, visibleByScheduleId],
  );

  const scheduleFingerprint = useMemo(() => schedulePlacesFingerprint(serverPlaces), [serverPlaces]);
  const routesBatchSettled = usePrefetchScheduleRoutes(
    roomId,
    scheduleId,
    serverPlaces,
    !isLoading && !isFetching && !isError && serverPlaces.length >= 2 && scheduleFingerprint.length > 0,
  );
  const existingItemIds = useMemo(
    () => new Set(serverPlaces.map((p) => p.itemId).filter((id): id is number => typeof id === "number")),
    [serverPlaces],
  );

  const [sheet, setSheet] = useState<MobilePlanPlaceSheet | null>(null);

  const itemExpenses = useCallback(
    (itemId: number | undefined) =>
      typeof itemId === "number"
        ? expensesInScope(expenses.list.data ?? [], { scheduleId, scheduleItemId: itemId, label: "" })
        : [],
    [expenses.list.data, scheduleId],
  );

  /** 카드 → 이 일차의 경로 보기(`/map?view=route`)에서 이 장소를 고른 채로 연다 */
  function openPlace(place: PlanPlace) {
    const dayNumber = sortRoomSchedules(schedules ?? []).findIndex((s) => s.scheduleId === scheduleId) + 1;
    router.push(buildMapRouteHref(Math.max(dayNumber, 1), place.itemId));
  }

  // ─── 방금 추가한 카드로 스크롤 + 강조 ─────────────────────────────────
  // 검색·북마크 화면은 오버레이라 목록 스크롤은 그대로 남아 있다. 새 카드가 화면 밖일 때만 최소한으로 움직인다
  const listRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  // 같은 장소로 두 번 스크롤하지 않게 — 강조 중 목록이 갱신돼도 다시 끌어오지 않는다
  const scrolledItemIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (recentlyAddedItemId === null || scrolledItemIdRef.current === recentlyAddedItemId) return;
    const row = listRef.current?.querySelector(`[data-plan-item-id="${recentlyAddedItemId}"]`);
    if (!row) return;
    scrolledItemIdRef.current = recentlyAddedItemId;
    row.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion ? "auto" : "smooth" });
  }, [places, prefersReducedMotion, recentlyAddedItemId]);

  // ─── 렌더 ────────────────────────────────────────────────────────────

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
              style={drag.rowStyle(scheduleId, index)}
            >
              <MobilePlanPlaceCard
                place={place}
                orderNumber={index + 1}
                badgeColor={badgeColor}
                highlighted={recentlyAddedItemId !== null && place.itemId === recentlyAddedItemId}
                expenseSummary={summarizeExpensesForMobile(itemExpenses(place.itemId))}
                onOpen={() => openPlace(place)}
                onOpenActions={() => setSheet({ kind: "actions", place })}
                onOpenExpenses={() => openPlaceExpenses(expenses, scheduleId, place)}
                onEditMemo={() => setSheet({ kind: "memo", place })}
                onEditTime={() => setSheet({ kind: "time", place })}
                editing={editing}
                dragDisabled={drag.dragDisabled || typeof place.itemId !== "number"}
                onHandlePointerDown={(e) => drag.startDrag(scheduleId, index, e)}
              />
              <PlaceTravelSegment
                place={place}
                next={next}
                editing={editing}
                roomId={roomId}
                scheduleId={scheduleId}
                scheduleFingerprint={scheduleFingerprint}
                routesReady={data !== undefined && !isFetching && routesBatchSettled}
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
        // 순서 편집 중에는 아직 저장 전인 이동과 섞일 수 있어 삽입을 막는다
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
    <PlanTravelTime
      contentOnly
      className="py-1"
      roomId={roomId}
      scheduleId={scheduleId}
      segmentSourceItemId={place.itemId}
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

/** 빈 일차 표시 — 평소에도 점선 박스이고, 순서 편집 중 카드가 올라오면 놓을 자리로 강조한다 */
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
