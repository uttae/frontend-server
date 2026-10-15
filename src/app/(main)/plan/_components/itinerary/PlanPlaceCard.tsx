"use client";

import { ExpenseEntryButton } from "@/components/expenses/ExpenseProvider";

import type { DragEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Loader2, MapPin } from "lucide-react";

import { CoinIcon, MemoAddIcon, TimeClockIcon } from "@/assets/icons";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { toast } from "sonner";

import { useInViewport } from "@/hooks/useInViewport";
import {
  useDeleteScheduleItem,
  useUpdateScheduleItem,
} from "@/hooks/useRooms";
import { usePlanPlaceCardPhoto } from "@/hooks/usePlanPlaceCardPhoto";
import { bucketItemCount } from "@/lib/analytics/context";
import { AnalyticsEvents, trackAnalyticsEvent } from "@/lib/analytics/track";
import { PLAN_PLACE_CARD_TW } from "@/lib/layout-tokens";
import { handlePlacePhotoImageError } from "@/lib/places/place-photo-refresh";
import {
  formatScheduleTimeRange,
} from "@/lib/plan/scheduleTime";
import type { PlanPlace } from "@/lib/plan/types";
import { cn } from "@/lib/utils";
import { useSelectedPlace } from "@/contexts/SelectedPlaceContext";
import {
  PLAN_MAP_FOCUS_NO_LOCATION_MESSAGE,
  planPlaceFocusTarget,
  usePlanMapFocusStore,
} from "@/stores/plan-map-focus-store";

import { PlanItemMemoEditor, PlanItemMemoReadOnly } from "./PlanItemMemoForm";
import { PlanItemTimeEditor } from "./PlanItemTimeForm";
import {
  isPlanPlaceCardInteractiveTarget,
  PlanOrderIndexBadge,
  PlanScheduleItemDeleteButton,
} from "./PlanPlaceCardParts";

export type PlanPlaceCardProps = {
  place: PlanPlace;
  itineraryItemCount: number;
  displayOrderIndex: number;
  orderBadgeColor?: string;
  isDragging: boolean;
  dragDisabled?: boolean;
  scheduleTimeEdit?: {
    roomId: string;
    scheduleId: number;
  };
  onDragStart: (e: DragEvent<Element>) => void;
  onDragEnd: (e: DragEvent<Element>) => void;
};

function stopCardActivation(e: React.SyntheticEvent) {
  e.stopPropagation();
}

export function PlanPlaceCard({
  place,
  itineraryItemCount,
  displayOrderIndex,
  orderBadgeColor,
  isDragging,
  dragDisabled = false,
  scheduleTimeEdit,
  onDragStart,
  onDragEnd,
}: PlanPlaceCardProps) {
  const { setSelectedPlace } = useSelectedPlace();
  const focusPlace = usePlanMapFocusStore((s) => s.focusPlace);
  const clearFocus = usePlanMapFocusStore((s) => s.clearFocus);
  const focusRoomId = scheduleTimeEdit?.roomId.trim() ?? "";
  const focusScheduleId = scheduleTimeEdit?.scheduleId ?? null;
  /** 고른 장소 — 다른 카드를 고르거나, 같은 카드를 다시 누르거나, 지도 빈 곳을 누를 때까지 강조해 둔다 */
  const focused = usePlanMapFocusStore(
    (s) =>
      s.focus !== null &&
      s.focus.roomId === focusRoomId &&
      s.focus.scheduleId === focusScheduleId &&
      s.focus.itemId === place.itemId,
  );
  /** 카드가 아닌 곳(지도 핀·장소 이동 스테퍼)에서 고른 경우에만 값이 있다 — 그때 일정 목록을 이 카드로 스크롤한다 */
  const focusSeqToReveal = usePlanMapFocusStore((s) =>
    s.focus !== null &&
    s.focus.source !== "card" &&
    s.focus.roomId === focusRoomId &&
    s.focus.scheduleId === focusScheduleId &&
    s.focus.itemId === place.itemId
      ? s.focus.seq
      : null,
  );
  const articleRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focusSeqToReveal === null) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    articleRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  }, [focusSeqToReveal]);
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);
  const blockCardDragRef = useRef(false);
  const [thumbnailRef, thumbnailInViewport] = useInViewport<HTMLElement>();
  const { resolvedPhotoUrl, photoLoading } = usePlanPlaceCardPhoto(place, {
    enabled: thumbnailInViewport,
  });

  const [memoOpen, setMemoOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);

  const { mutateAsync: removeScheduleItemMutate, isPending: isDeletingItem } =
    useDeleteScheduleItem();
  const { mutateAsync: updateScheduleItemMutate, isPending: isUpdatingItem } =
    useUpdateScheduleItem();
  const [confirmTarget, setConfirmTarget] = useState<"item" | "memo" | null>(
    null,
  );

  const canManageServerItem =
    Boolean(scheduleTimeEdit) && typeof place.itemId === "number";

  const handleDeleteScheduleItem = useCallback(async () => {
    if (!scheduleTimeEdit || typeof place.itemId !== "number") return;
    try {
      await removeScheduleItemMutate({
        roomId: scheduleTimeEdit.roomId,
        scheduleId: scheduleTimeEdit.scheduleId,
        itemId: place.itemId,
      });
      trackAnalyticsEvent(AnalyticsEvents.removeFromItinerary, {
        room_id: scheduleTimeEdit.roomId,
        item_count_bucket: bucketItemCount(itineraryItemCount - 1),
      });
      toast.success("일정에서 삭제했어요.");
      setConfirmTarget(null);
    } catch {
      toast.error("삭제하지 못했어요.");
    }
  }, [
    itineraryItemCount,
    scheduleTimeEdit,
    place.itemId,
    removeScheduleItemMutate,
  ]);

  const handleDeleteMemo = useCallback(async () => {
    if (!scheduleTimeEdit || typeof place.itemId !== "number") return;
    try {
      await updateScheduleItemMutate({
        roomId: scheduleTimeEdit.roomId,
        scheduleId: scheduleTimeEdit.scheduleId,
        itemId: place.itemId,
        body: { memo: "" },
      });
      toast.success("메모를 삭제했어요.");
      setConfirmTarget(null);
    } catch {
      toast.error("메모를 삭제하지 못했어요.");
    }
  }, [scheduleTimeEdit, place.itemId, updateScheduleItemMutate]);

  const handlePointerDownCapture = useCallback(
    (e: React.PointerEvent) => {
      blockCardDragRef.current = isPlanPlaceCardInteractiveTarget(e.target);
      if (blockCardDragRef.current) return;
      pointerDownRef.current = { x: e.clientX, y: e.clientY };
    },
    [],
  );

  const handleDragStart = useCallback(
    (e: DragEvent<Element>) => {
      if (blockCardDragRef.current) {
        blockCardDragRef.current = false;
        e.preventDefault();
        return;
      }
      onDragStart(e);
    },
    [onDragStart],
  );

  const handleDragEnd = useCallback(
    (e: DragEvent<Element>) => {
      blockCardDragRef.current = false;
      onDragEnd(e);
    },
    [onDragEnd],
  );

  const handleCardClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const start = pointerDownRef.current;
      pointerDownRef.current = null;
      if (start) {
        const moved =
          Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y);
        if (moved > 12) return;
      }
      if (!focusRoomId || focusScheduleId === null || typeof place.itemId !== "number") return;
      // 고른 카드를 다시 누르면 강조와 "이 일차 경로만 보기"를 푼다
      if (focused) {
        clearFocus();
        setSelectedPlace(null);
        return;
      }
      const target = planPlaceFocusTarget(place, focusRoomId, focusScheduleId, "card");
      if (!target) return;
      // 일정에 넣은 장소는 상세를 보려는 게 아니라 위치를 보려는 것 — 상세(조회 포함) 대신 카드·지도 핀만 강조한다
      setSelectedPlace(null);
      focusPlace(target);
      if (!target.location) toast.info(PLAN_MAP_FOCUS_NO_LOCATION_MESSAGE);
    },
    [
      clearFocus,
      focusPlace,
      focusRoomId,
      focusScheduleId,
      focused,
      place,
      setSelectedPlace,
    ],
  );

  const scheduleItemId =
    scheduleTimeEdit && typeof place.itemId === "number" ? place.itemId : null;

  const canEditScheduleItem =
    scheduleTimeEdit != null && scheduleItemId !== null;

  const rawGooglePlaceId =
    typeof place.googlePlaceId === "string" ? place.googlePlaceId.trim() : "";
  const hasGooglePlace = rawGooglePlaceId.length > 0;

  const memoText = typeof place.memo === "string" ? place.memo.trim() : "";
  const hasMemo = memoText.length > 0;
  const timeRange = formatScheduleTimeRange(
    place.startTime ?? "",
    place.endTime,
  );
  const hasTime = Boolean(timeRange);

  const deleteButton = canManageServerItem ? (
    <PlanScheduleItemDeleteButton
      disabled={isDeletingItem}
      onDelete={() => setConfirmTarget("item")}
    />
  ) : null;

  const memoTrigger = canEditScheduleItem ? (
    <button
      type="button"
      data-plan-card-no-drag
      onMouseDown={stopCardActivation}
      onClick={(e) => {
        stopCardActivation(e);
        setMemoOpen((v) => !v);
      }}
      aria-expanded={memoOpen}
      aria-label={hasMemo ? "메모 수정" : "메모 추가"}
      className={cn(
        PLAN_PLACE_CARD_TW.actionButton,
        PLAN_PLACE_CARD_TW.actionButtonTrailing,
      )}
    >
      <MemoAddIcon size={16} className={PLAN_PLACE_CARD_TW.actionIcon} />
      <span>메모</span>
    </button>
  ) : null;

  const timeTrigger = canEditScheduleItem ? (
    <button
      type="button"
      data-plan-card-no-drag
      onMouseDown={stopCardActivation}
      onClick={(e) => {
        stopCardActivation(e);
        setTimeOpen((v) => !v);
      }}
      aria-expanded={timeOpen}
      aria-label={hasTime ? `시간 ${timeRange} 수정` : "시간 설정"}
      className={cn(PLAN_PLACE_CARD_TW.actionButton, "tabular-nums")}
    >
      <TimeClockIcon size={16} className={PLAN_PLACE_CARD_TW.actionIcon} />
      <span>{timeRange || "시간"}</span>
    </button>
  ) : null;

  return (
    <div className="flex w-full flex-col gap-2">
      <article
        ref={articleRef}
        draggable={!dragDisabled}
        onPointerDownCapture={handlePointerDownCapture}
        onDragStart={dragDisabled ? undefined : handleDragStart}
        onDragEnd={dragDisabled ? undefined : handleDragEnd}
        onClick={handleCardClick}
        aria-current={focused || undefined}
        className={cn(
          "w-full select-none transition-colors",
          PLAN_PLACE_CARD_TW.article,
          focused && "border-primary",
          dragDisabled
            ? "cursor-default"
            : "cursor-grab active:cursor-grabbing",
        )}
        aria-grabbed={isDragging}
      >
        <PlanOrderIndexBadge
          orderIndex={displayOrderIndex}
          backgroundColorHex={orderBadgeColor}
        />

        {(() => {
          const media = photoLoading ? (
            <Loader2
              className="absolute inset-0 m-auto h-5 w-5 animate-spin text-primary-strong"
              aria-hidden
            />
          ) : resolvedPhotoUrl ? (
            <Image
              src={resolvedPhotoUrl}
              alt={place.title}
              fill
              className="object-cover"
              sizes="96px"
              draggable={false}
              onError={(event) =>
                handlePlacePhotoImageError({
                  source: "plan-place-card",
                  googlePlaceId: place.googlePlaceId,
                  placeName: place.title,
                  image: event.currentTarget,
                })
              }
            />
          ) : null;

          if (!hasGooglePlace) {
            return (
              <div ref={thumbnailRef} className={PLAN_PLACE_CARD_TW.thumbnail}>
                {media}
              </div>
            );
          }

          return (
            <div
              ref={thumbnailRef}
              className={cn(
                PLAN_PLACE_CARD_TW.thumbnail,
                "block cursor-pointer transition hover:brightness-105",
              )}
            >
              {media}
              <span
                className="pointer-events-none absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-md bg-black/60 text-white shadow-sm ring-1 ring-white/25"
                aria-hidden
              >
                <MapPin className="h-3 w-3" strokeWidth={2.4} />
              </span>
            </div>
          );
        })()}

        <div className={PLAN_PLACE_CARD_TW.contentColumn}>
          <div className={PLAN_PLACE_CARD_TW.titleRow}>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h3 className={PLAN_PLACE_CARD_TW.title} title={place.title}>
                {place.title}
              </h3>
              {place.primaryTypeDisplayName ? (
                <span className={PLAN_PLACE_CARD_TW.primaryTypeBadge}>
                  {place.primaryTypeDisplayName}
                </span>
              ) : null}
            </div>
            {deleteButton ? (
              // 휴지통은 썸네일 윗선에 맞추고 오른쪽 테두리에서 17px에 둔다
              <span className="-mr-1 -mt-1.5 flex shrink-0 self-start">{deleteButton}</span>
            ) : null}
          </div>

          {place.subtitle ? (
            <p
              className={cn(PLAN_PLACE_CARD_TW.subtitle, "mobile:hidden")}
              title={place.subtitle}
            >
              {place.subtitle}
            </p>
          ) : null}

          {timeRange && !canEditScheduleItem ? (
            <span
              className={cn(
                "mt-auto inline-flex w-fit items-center rounded-md bg-primary/10 px-2 py-0.5",
                PLAN_PLACE_CARD_TW.titleCompact,
                "text-body-s-regular mobile:text-body-xs-regular tabular-nums text-primary-strong",
              )}
            >
              {timeRange}
            </span>
          ) : null}
        </div>

        {canEditScheduleItem ? (
          // 디자인: 구분선 위아래 8px, 버튼 아래 카드 테두리까지 5px
          <div className="col-span-2 -mb-[9px] mt-2 border-t border-gray-100 pt-2">
            <div className={PLAN_PLACE_CARD_TW.actionBar}>
              <div className="flex min-w-0 items-center">
                {timeTrigger}
                {scheduleTimeEdit && scheduleItemId !== null && (
                  <ExpenseEntryButton
                    scheduleId={scheduleTimeEdit.scheduleId}
                    scheduleItemId={scheduleItemId}
                    scopeLabel={place.title}
                    label="비용"
                    // 금액이 길면 메모 버튼 앞에서 말줄임되도록 공통 버튼의 shrink-0를 푼다
                    className={cn(PLAN_PLACE_CARD_TW.actionButton, "min-w-0 shrink")}
                    icon={<CoinIcon size={16} className={PLAN_PLACE_CARD_TW.actionIcon} />}
                  />
                )}
              </div>
              {memoTrigger}
            </div>
          </div>
        ) : null}
      </article>

      {canEditScheduleItem && timeOpen && scheduleTimeEdit && scheduleItemId !== null ? (
        <PlanItemTimeEditor
          key={`time-${scheduleTimeEdit.scheduleId}-${scheduleItemId}`}
          roomId={scheduleTimeEdit.roomId}
          scheduleId={scheduleTimeEdit.scheduleId}
          itemId={scheduleItemId}
          startTime={place.startTime ?? ""}
          endTime={place.endTime}
          onClose={() => setTimeOpen(false)}
        />
      ) : null}

      {canEditScheduleItem && memoOpen && scheduleTimeEdit && scheduleItemId !== null ? (
        <PlanItemMemoEditor
          key={`memo-${scheduleTimeEdit.scheduleId}-${scheduleItemId}`}
          roomId={scheduleTimeEdit.roomId}
          scheduleId={scheduleTimeEdit.scheduleId}
          itemId={scheduleItemId}
          memo={place.memo}
          onClose={() => setMemoOpen(false)}
        />
      ) : null}

      {hasMemo && !memoOpen ? (
        <PlanItemMemoReadOnly
          memo={memoText}
          onDelete={
            canEditScheduleItem ? () => setConfirmTarget("memo") : undefined
          }
          isDeleting={isUpdatingItem}
        />
      ) : null}
      {confirmTarget === "item" ? (
        <ConfirmDialog
          title="일정에서 이 장소를 삭제할까요?"
          description="이 장소와 연결된 모든 비용도 함께 삭제돼요."
          confirmLabel="삭제"
          isPending={isDeletingItem}
          onConfirm={() => void handleDeleteScheduleItem()}
          onCancel={() => setConfirmTarget(null)}
        />
      ) : null}
      {confirmTarget === "memo" ? (
        <ConfirmDialog
          title="메모를 삭제할까요?"
          confirmLabel="삭제"
          isPending={isUpdatingItem}
          onConfirm={() => void handleDeleteMemo()}
          onCancel={() => setConfirmTarget(null)}
        />
      ) : null}
    </div>
  );
}
