"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { toast } from "sonner";

import { useDragAutoScroll } from "@/hooks/useDragAutoScroll";
import {
  useMoveScheduleItemToSchedule,
  useReorderScheduleItem,
} from "@/hooks/useRooms";
import { bucketItemCount } from "@/lib/analytics/context";
import { AnalyticsEvents, trackAnalyticsEvent } from "@/lib/analytics/track";
import {
  beginPlanItemDrag,
  clampCrossDayTargetOrderIndex,
  computePlanItemRowPreviewOrderIndex,
  computePlanItemRowPreviewTranslateY,
  executePlanItemCrossDayMove,
  getPlanItemRowReorderStyle,
  isPlanItemDrag,
  type PlanItemRowPreviewMode,
  PlanItemRowLayoutSnapshot,
  readPlanItemDragIndex,
} from "@/lib/plan/planItemReorder";
import { newOrderIndexAfterMove } from "@/lib/plan/scheduleItemPlaces";
import type { PlanPlace } from "@/lib/plan/types";
import { usePlanItemCrossDayDragStore } from "@/stores/plan-item-cross-day-drag-store";
import { usePlanItineraryExpandedStore } from "@/stores/plan-itinerary-expanded-store";

type UsePlanItineraryReorderArgs = {
  roomId: string;
  scheduleId: number;
  places: PlanPlace[];
  /** 장소 추가 등 D&D 외 상호작용 잠금 */
  interactionLocked?: boolean;
};

function normalizeSameDayDropIndex(
  previewIndex: number | null,
  placesLength: number,
): number | null {
  if (previewIndex === null || !Number.isFinite(previewIndex)) return null;
  if (placesLength <= 0) return 0;
  if (previewIndex >= placesLength) return placesLength - 1;
  return previewIndex;
}

export function usePlanItineraryReorder({
  roomId,
  scheduleId,
  places,
  interactionLocked = false,
}: UsePlanItineraryReorderArgs) {
  const { mutateAsync: reorderMutate, isReorderSettling } =
    useReorderScheduleItem();
  const { mutateAsync: moveMutate, isPending: isMovePending } =
    useMoveScheduleItemToSchedule();
  const beginItemDrag = usePlanItemCrossDayDragStore((s) => s.beginItemDrag);
  const draggedRowHeight = usePlanItemCrossDayDragStore(
    (s) => s.draggedRowHeight,
  );
  const setHoverTarget = usePlanItemCrossDayDragStore((s) => s.setHoverTarget);
  const endItemDrag = usePlanItemCrossDayDragStore((s) => s.endItemDrag);

  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [incomingExternalDrag, setIncomingExternalDrag] = useState(false);

  const rowRefs = useRef<(HTMLElement | null)[]>([]);
  const layoutSnapshotRef = useRef(new PlanItemRowLayoutSnapshot());
  const pointerYRef = useRef(0);
  const dragOverRafRef = useRef(0);
  const externalCaptureRafRef = useRef(0);

  const mutationLocked =
    interactionLocked || isReorderSettling || isMovePending;
  const isDraggingActive = dragFromIndex !== null || incomingExternalDrag;

  useDragAutoScroll({ active: isDraggingActive });

  const resetDragPreview = useCallback(() => {
    setDragFromIndex(null);
    setPreviewIndex(null);
    setIncomingExternalDrag(false);
    layoutSnapshotRef.current.clear();
    if (externalCaptureRafRef.current) {
      cancelAnimationFrame(externalCaptureRafRef.current);
      externalCaptureRafRef.current = 0;
    }
    endItemDrag();
  }, [endItemDrag]);

  const setRowRef = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      rowRefs.current[index] = el;
    },
    [],
  );

  const updatePreviewFromPointer = useCallback(() => {
    if (layoutSnapshotRef.current.isEmpty) return;
    if (dragFromIndex === null && !incomingExternalDrag) return;

    const nextPreview = layoutSnapshotRef.current.previewIndexAt(
      pointerYRef.current,
    );
    setPreviewIndex((prev) => (prev === nextPreview ? prev : nextPreview));
  }, [dragFromIndex, incomingExternalDrag]);

  const schedulePreviewUpdate = useCallback(() => {
    if (dragOverRafRef.current) return;
    dragOverRafRef.current = requestAnimationFrame(() => {
      dragOverRafRef.current = 0;
      updatePreviewFromPointer();
    });
  }, [updatePreviewFromPointer]);

  const beginExternalDragCapture = useCallback(
    (pointerY: number) => {
      const tryCapture = (attempt = 0) => {
        const rowsReady =
          places.length === 0 ||
          rowRefs.current.some((el) => el instanceof HTMLElement);

        if (rowsReady || attempt >= 8) {
          layoutSnapshotRef.current.capture(rowRefs.current);
          setIncomingExternalDrag(true);
          setPreviewIndex(
            places.length > 0
              ? layoutSnapshotRef.current.previewIndexAt(pointerY)
              : 0,
          );
          externalCaptureRafRef.current = 0;
          return;
        }

        externalCaptureRafRef.current = requestAnimationFrame(() =>
          tryCapture(attempt + 1),
        );
      };

      if (externalCaptureRafRef.current) {
        cancelAnimationFrame(externalCaptureRafRef.current);
      }
      tryCapture();
    },
    [places.length],
  );

  useEffect(() => {
    return () => {
      if (dragOverRafRef.current) {
        cancelAnimationFrame(dragOverRafRef.current);
      }
      if (externalCaptureRafRef.current) {
        cancelAnimationFrame(externalCaptureRafRef.current);
      }
    };
  }, []);

  const handleDragStart = useCallback(
    (index: number) => (e: DragEvent<Element>) => {
      const itemId = places[index]?.itemId;
      if (mutationLocked || typeof itemId !== "number") return;
      const target = e.currentTarget;
      if (!(target instanceof HTMLElement)) return;
      beginPlanItemDrag(e.nativeEvent, target, index, {
        scheduleId,
        itemId,
      });
      layoutSnapshotRef.current.capture(rowRefs.current);
      const rowHeight =
        layoutSnapshotRef.current.heights()[index] ??
        target.getBoundingClientRect().height;
      beginItemDrag(scheduleId, rowHeight);
      setDragFromIndex(index);
      setPreviewIndex(index);
    },
    [beginItemDrag, mutationLocked, places, scheduleId],
  );

  const handleDragEnd = useCallback(() => {
    if (dragOverRafRef.current) {
      cancelAnimationFrame(dragOverRafRef.current);
      dragOverRafRef.current = 0;
    }
    resetDragPreview();
  }, [resetDragPreview]);

  const handleListDragOver = useCallback(
    (e: DragEvent<Element>) => {
      if (mutationLocked) return;

      const external = dragFromIndex === null && isPlanItemDrag(e.dataTransfer);
      if (dragFromIndex === null && !external) return;

      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      pointerYRef.current = e.clientY;

      if (external) {
        usePlanItineraryExpandedStore
          .getState()
          .setScheduleExpanded(scheduleId, true);
        setHoverTarget(scheduleId);
        if (layoutSnapshotRef.current.isEmpty && !incomingExternalDrag) {
          beginExternalDragCapture(e.clientY);
        }
      }

      schedulePreviewUpdate();
    },
    [
      beginExternalDragCapture,
      dragFromIndex,
      incomingExternalDrag,
      mutationLocked,
      scheduleId,
      schedulePreviewUpdate,
      setHoverTarget,
    ],
  );

  const handleListDragLeave = useCallback(
    (e: DragEvent<Element>) => {
      const next = e.relatedTarget as Node | null;
      if (next && e.currentTarget.contains(next)) return;

      if (incomingExternalDrag) {
        setIncomingExternalDrag(false);
        setPreviewIndex(null);
        layoutSnapshotRef.current.clear();
        if (externalCaptureRafRef.current) {
          cancelAnimationFrame(externalCaptureRafRef.current);
          externalCaptureRafRef.current = 0;
        }
        setHoverTarget(null);
        return;
      }

      if (dragFromIndex === null) return;
      setPreviewIndex(dragFromIndex);
    },
    [dragFromIndex, incomingExternalDrag, setHoverTarget],
  );

  const handleListDrop = useCallback(
    async (e: DragEvent<Element>) => {
      e.preventDefault();

      const dataTransfer = e.dataTransfer;
      const fromIndex = readPlanItemDragIndex(dataTransfer);
      const dropPreviewIndex =
        previewIndex ??
        (Number.isFinite(fromIndex) ? fromIndex : null);

      const crossDayHandled = await executePlanItemCrossDayMove({
        dataTransfer,
        roomId,
        targetScheduleId: scheduleId,
        targetOrderIndex: clampCrossDayTargetOrderIndex(
          dropPreviewIndex ?? 0,
          places.length,
        ),
        moveMutate,
        onError: (message) => toast.error(message),
      });

      resetDragPreview();

      if (crossDayHandled) return;

      const toIndex = normalizeSameDayDropIndex(dropPreviewIndex, places.length);

      if (
        !Number.isFinite(fromIndex) ||
        fromIndex < 0 ||
        fromIndex >= places.length ||
        toIndex === null ||
        toIndex < 0 ||
        toIndex >= places.length ||
        fromIndex === toIndex
      ) {
        return;
      }

      const itemId = places[fromIndex]?.itemId;
      if (typeof itemId !== "number") return;

      try {
        await reorderMutate({
          roomId,
          scheduleId,
          itemId,
          body: {
            newOrderIndex: newOrderIndexAfterMove(
              fromIndex,
              toIndex,
              places.length,
            ),
          },
        });
        trackAnalyticsEvent(AnalyticsEvents.reorderItinerary, {
          room_id: roomId,
          item_count_bucket: bucketItemCount(places.length),
          method: "drag_drop",
        });
      } catch {
        toast.error("순서를 바꾸지 못했어요.");
      }
    },
    [
      moveMutate,
      places,
      previewIndex,
      reorderMutate,
      resetDragPreview,
      roomId,
      scheduleId,
    ],
  );

  const getRowProps = useCallback(
    (index: number, motionEnabled: boolean) => {
      const fromIdx = dragFromIndex;
      const previewIdx = previewIndex;
      const snapshot = layoutSnapshotRef.current;
      const insertHeight = draggedRowHeight ?? 0;

      let previewMode: PlanItemRowPreviewMode | null = null;
      if (
        incomingExternalDrag &&
        previewIdx !== null &&
        insertHeight > 0
      ) {
        previewMode = {
          kind: "insert",
          previewIndex: previewIdx,
          insertHeight,
        };
      } else if (
        fromIdx !== null &&
        previewIdx !== null &&
        fromIdx !== previewIdx &&
        !snapshot.isEmpty
      ) {
        previewMode = {
          kind: "reorder",
          fromIndex: fromIdx,
          previewIndex: previewIdx,
          rowHeights: snapshot.heights(),
        };
      }

      const translateY = computePlanItemRowPreviewTranslateY(index, previewMode);
      const isDragging = fromIdx === index;
      const displayOrderIndex = computePlanItemRowPreviewOrderIndex(
        index,
        places.length,
        previewMode,
      );

      return {
        ref: setRowRef(index),
        style: getPlanItemRowReorderStyle({
          translateY,
          isDragging,
          motionEnabled,
        }),
        placeCardDragProps: {
          displayOrderIndex,
          isDragging,
          dragDisabled:
            mutationLocked || typeof places[index]?.itemId !== "number",
          onDragStart: handleDragStart(index),
          onDragEnd: handleDragEnd,
        },
      };
    },
    [
      dragFromIndex,
      draggedRowHeight,
      handleDragEnd,
      handleDragStart,
      incomingExternalDrag,
      mutationLocked,
      places,
      previewIndex,
      setRowRef,
    ],
  );

  const listContainerProps = {
    onDragOver: mutationLocked ? undefined : handleListDragOver,
    onDragLeave: mutationLocked ? undefined : handleListDragLeave,
    onDrop: mutationLocked ? undefined : handleListDrop,
  };

  const listReservePaddingBottom =
    incomingExternalDrag && (draggedRowHeight ?? 0) > 0
      ? (draggedRowHeight ?? 0)
      : 0;

  return {
    getRowProps,
    listContainerProps,
    isDraggingActive,
    isReorderSettling: isReorderSettling || isMovePending,
    listReservePaddingBottom,
  };
}
