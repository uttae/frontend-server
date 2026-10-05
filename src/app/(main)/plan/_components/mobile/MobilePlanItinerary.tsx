"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PlanLoadingSkeleton } from "../PlanLoadingSkeleton";
import { toast } from "sonner";

import {
  CoinIcon,
  PlusIcon,
  TimeClockIcon,
  TrashIcon,
  WriteAddIcon,
  WriteIcon,
} from "@/assets/icons";
import { useExpenseContext } from "@/components/expenses/ExpenseProvider";
import {
  MobileBottomSheet,
  MobileSheetMenuItem,
} from "@/components/mobile/MobileBottomSheet";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { useOpenPlaceOnMap } from "@/hooks/useOpenPlaceOnMap";
import { usePrefetchScheduleRoutes } from "@/hooks/usePrefetchScheduleRoutes";
import { useDeleteScheduleItem, useSchedulePlanPlaces } from "@/hooks/useRooms";
import { bucketItemCount } from "@/lib/analytics/context";
import { AnalyticsEvents, trackAnalyticsEvent } from "@/lib/analytics/track";
import { expensesInScope } from "@/lib/expenses/expense-scope";
import { normalizeGooglePlaceResourceId } from "@/lib/maps";
import { summarizeExpensesForMobile } from "@/lib/plan/mobilePlanFormat";
import { planCopy } from "@/lib/plan/planCopy";
import { schedulePlacesFingerprint } from "@/lib/plan/planTravelLocalStorage";
import {
  scheduleIdsToRouteColors,
  sortedScheduleIdsForRouteColors,
} from "@/lib/plan/planRouteDayColors";
import type { PlanPlace } from "@/lib/plan/types";
import { cn } from "@/lib/utils";
import { usePlanScheduleRouteVisibilityStore } from "@/stores/plan-schedule-route-visibility-store";

import { AddFromBookmarkModal } from "../itinerary/AddFromBookmarkModal";
import { PlanTravelTime } from "../travel-time/PlanTravelTime";
import { MobileMemoSheet } from "./MobileMemoSheet";
import { MobilePlanPlaceCard } from "./MobilePlanPlaceCard";
import { MobileTimeSheet } from "./MobileTimeSheet";
import { applyPendingPlanMove, useMobilePlanDrag } from "./mobilePlanDrag";

const EMPTY_PLACES: PlanPlace[] = [];

type SheetState =
  | { kind: "actions"; place: PlanPlace }
  | { kind: "memo"; place: PlanPlace }
  | { kind: "time"; place: PlanPlace }
  | { kind: "delete"; place: PlanPlace };

type MobilePlanItineraryProps = Readonly<{
  roomId: string;
  scheduleId: number;
  /** `9월 21일` — 방문 시간 시트에 표시 */
  monthDayLabel?: string;
  /** 전체 화면 검색으로 이 일차에 장소 추가 — 탭 제스처 안에서 호출해야 한다 */
  onRequestAddPlace: (places: PlanPlace[]) => void;
}>;

/** 모바일 일차별 장소 목록 — 카드·이동 요약·추가 버튼, 편집 모드에서는 핸들로 순서를 바꾼다(다른 일차로도) */
export function MobilePlanItinerary({
  roomId,
  scheduleId,
  monthDayLabel,
  onRequestAddPlace,
}: MobilePlanItineraryProps) {
  const expenses = useExpenseContext();
  const openPlaceOnMap = useOpenPlaceOnMap();
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

  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [bookmarkOpen, setBookmarkOpen] = useState(false);
  const { mutateAsync: removeItem, isPending: isRemoving } = useDeleteScheduleItem();

  const itemExpenses = useCallback(
    (itemId: number | undefined) =>
      typeof itemId === "number"
        ? expensesInScope(expenses.list.data ?? [], { scheduleId, scheduleItemId: itemId, label: "" })
        : [],
    [expenses.list.data, scheduleId],
  );

  function openPlace(place: PlanPlace) {
    const loc = place.location;
    if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) {
      toast.info("지도에 표시할 위치 정보가 없어요.");
      return;
    }
    const rawId = place.googlePlaceId?.trim() ?? "";
    openPlaceOnMap(
      {
        name: place.title,
        category: "",
        rating: null,
        ...(rawId ? { googlePlaceId: normalizeGooglePlaceResourceId(rawId) } : {}),
        location: { lat: loc.lat, lng: loc.lng },
        address: place.subtitle,
      },
      { analyticsSource: "plan" },
    );
  }

  function openItemExpenses(place: PlanPlace) {
    if (typeof place.itemId !== "number") return;
    const scoped = itemExpenses(place.itemId);
    if (scoped.length === 0) expenses.open({ scheduleId, scheduleItemId: place.itemId });
    else expenses.openScope({ scheduleId, scheduleItemId: place.itemId, label: place.title });
  }

  async function handleDelete(place: PlanPlace) {
    if (typeof place.itemId !== "number") return;
    try {
      await removeItem({ roomId, scheduleId, itemId: place.itemId });
      trackAnalyticsEvent(AnalyticsEvents.removeFromItinerary, {
        item_count_bucket: bucketItemCount(places.length - 1),
      });
      toast.success("일정에서 삭제했어요.");
      setSheet(null);
    } catch {
      toast.error("삭제하지 못했어요.");
    }
  }

  // ─── 렌더 ────────────────────────────────────────────────────────────
  const sheetPlace = sheet?.place;
  const sheetItemId = typeof sheetPlace?.itemId === "number" ? sheetPlace.itemId : null;

  return (
    <div className="flex flex-col">
      <PlanPlaceStatus isLoading={isLoading} isError={isError} />

      <div
        ref={(el) => drag.registerList(scheduleId, el)}
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
              ref={(el) => drag.registerRow(scheduleId, index, el)}
              style={drag.rowStyle(scheduleId, index)}
            >
              <MobilePlanPlaceCard
                place={place}
                orderNumber={index + 1}
                badgeColor={badgeColor}
                expenseSummary={summarizeExpensesForMobile(itemExpenses(place.itemId))}
                onOpen={() => openPlace(place)}
                onOpenActions={() => setSheet({ kind: "actions", place })}
                onOpenExpenses={() => openItemExpenses(place)}
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
          onClick={() => onRequestAddPlace(places)}
          className="flex items-center justify-center rounded-lg border border-border-subtle bg-fill-subtle px-3.5 py-3"
        >
          <PlusIcon size={20} className="text-icon-subtle" />
          <span className="px-1.5 text-label-l-emphasis text-text-subtle">장소 추가</span>
        </button>
        <button
          type="button"
          onClick={() => setBookmarkOpen(true)}
          className="flex items-center justify-center rounded-lg border border-border-subtle bg-fill-subtle px-3.5 py-3"
        >
          <span className="px-1.5 text-label-l-emphasis text-text-subtle">북마크에서 추가</span>
        </button>
      </div>

      {sheet?.kind === "actions" && sheetPlace ? (
        <MobilePlanActionSheet
          place={sheetPlace}
          itemId={sheetItemId}
          canManageExpenses={expenses.canManage}
          expensesBusy={expenses.busy}
          onClose={() => setSheet(null)}
          onChangeSheet={setSheet}
          onAddExpense={(itemId) => {
            setSheet(null);
            expenses.open({ scheduleId, scheduleItemId: itemId });
          }}
        />
      ) : null}

      {sheet?.kind === "memo" && sheetPlace && sheetItemId !== null ? (
        <MobileMemoSheet
          roomId={roomId}
          scheduleId={scheduleId}
          itemId={sheetItemId}
          placeName={sheetPlace.title}
          memo={sheetPlace.memo ?? ""}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet?.kind === "time" && sheetPlace && sheetItemId !== null ? (
        <MobileTimeSheet
          roomId={roomId}
          scheduleId={scheduleId}
          itemId={sheetItemId}
          placeName={sheetPlace.title}
          dateLabel={monthDayLabel}
          startTime={sheetPlace.startTime}
          endTime={sheetPlace.endTime}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet?.kind === "delete" && sheetPlace ? (
        <ConfirmDialog
          title="일정에서 이 장소를 삭제할까요?"
          description="이 장소와 연결된 모든 비용도 함께 삭제돼요."
          confirmLabel="삭제"
          isPending={isRemoving}
          onConfirm={() => void handleDelete(sheetPlace)}
          onCancel={() => setSheet(null)}
        />
      ) : null}

      {bookmarkOpen ? (
        <AddFromBookmarkModal
          roomId={roomId}
          scheduleId={scheduleId}
          places={places}
          onClose={() => setBookmarkOpen(false)}
        />
      ) : null}
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

function MobilePlanActionSheet({
  place,
  itemId,
  canManageExpenses,
  expensesBusy,
  onClose,
  onChangeSheet,
  onAddExpense,
}: Readonly<{
  place: PlanPlace;
  itemId: number | null;
  canManageExpenses: boolean;
  expensesBusy: boolean;
  onClose: () => void;
  onChangeSheet: (sheet: SheetState) => void;
  onAddExpense: (itemId: number) => void;
}>) {
  return (
    <MobileBottomSheet open onClose={onClose} title={place.title}>
      {itemId === null ? (
        <p className="py-2 text-body-s-regular text-text-subtle">
          아직 저장 중인 장소예요. 잠시 후 다시 시도해 주세요.
        </p>
      ) : (
        <>
          <MobileSheetMenuItem
            icon={place.memo?.trim() ? WriteIcon : WriteAddIcon}
            label={place.memo?.trim() ? "메모 수정" : "메모 추가"}
            onClick={() => onChangeSheet({ kind: "memo", place })}
          />
          <MobileSheetMenuItem
            icon={TimeClockIcon}
            label="시간 설정"
            onClick={() => onChangeSheet({ kind: "time", place })}
          />
          {canManageExpenses ? (
            <MobileSheetMenuItem
              icon={CoinIcon}
              label="비용 추가"
              disabled={expensesBusy}
              onClick={() => onAddExpense(itemId)}
            />
          ) : null}
          <MobileSheetMenuItem
            icon={TrashIcon}
            label="일정 삭제"
            danger
            onClick={() => onChangeSheet({ kind: "delete", place })}
          />
        </>
      )}
    </MobileBottomSheet>
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

/**
 * 빈 일차 표시 — 평소에도 점선 박스이고, 순서 편집 중 카드가 올라오면 놓을 자리로 강조한다.
 * CSS 점선은 점 길이를 못 바꿔서 SVG로 긴 점선 테두리를 그린다.
 */
function EmptyDayDropZone({ active }: Readonly<{ active: boolean }>) {
  return (
    <div
      className={cn(
        "relative flex h-14 items-center justify-center rounded-md text-body-s-regular transition-colors",
        // primary-subtle은 이 영역에 너무 진해 한 단계 연한 원시 토큰을 쓴다
        active ? "bg-[var(--blue-50)] text-primary" : "text-text-subtle",
      )}
    >
      <svg aria-hidden className="pointer-events-none absolute inset-0 size-full overflow-visible">
        <rect
          width="100%"
          height="100%"
          rx="6"
          fill="none"
          strokeWidth="1"
          strokeDasharray="8 6"
          className={cn("transition-colors", active ? "stroke-primary" : "stroke-border")}
        />
      </svg>
      {active ? "여기에 놓기" : planCopy.placesEmpty}
    </div>
  );
}
