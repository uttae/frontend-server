import { useReducedMotion } from "framer-motion";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react";

import { useDragAutoScroll } from "@/hooks/useDragAutoScroll";
import { usePlanItemDropCommit } from "@/hooks/usePlanItemDropCommit";
import {
  beginPlanItemDrag,
  computePlanItemRowPreviewOrderIndex,
  computePlanItemRowPreviewTranslateY,
  getPlanItemRowReorderStyle,
  PLAN_ITEM_ITINERARY_DROP_ZONE_ATTR,
  PlanItemRowLayoutSnapshot,
  type PlanItemRowPreviewMode,
} from "@/lib/plan/planItemReorder";
import type { PlanPlace } from "@/lib/plan/types";
import { usePlanItineraryExpandedStore } from "@/stores/plan-itinerary-expanded-store";

type PlanItemDragState = {
  itemId: number;
  sourceScheduleId: number;
  sourceIndex: number;
  sourceRowHeights: readonly number[];
  rowHeight: number;
  overScheduleId: number | null;
  overIndex: number | null;
  dropped: { scheduleId: number; places: readonly PlanPlace[] | undefined } | null;
};

type DropHandlers = {
  onDragOver: (e: DragEvent<Element>) => void;
  onDragLeave: (e: DragEvent<Element>) => void;
  onDrop: (e: DragEvent<Element>) => void;
};

export type PlanItemDragRowProps = {
  ref: (el: HTMLElement | null) => void;
  style: CSSProperties | undefined;
  placeCardDragProps: {
    displayOrderIndex: number;
    isDragging: boolean;
    dragDisabled: boolean;
    onDragStart: (e: DragEvent<Element>) => void;
    onDragEnd: () => void;
  };
};

export type PlanItemDragListProps = {
  dropZoneProps: DropHandlers & { [PLAN_ITEM_ITINERARY_DROP_ZONE_ATTR]: "" };
  isItemDragActive: boolean;
  reservePaddingBottom: number;
  getRowProps: (index: number) => PlanItemDragRowProps;
};

export type PlanItemSectionDrop = {
  props: DropHandlers;
  isTarget: boolean;
};

export type PlanItemDragValue = {
  getListProps: (
    scheduleId: number,
    places: readonly PlanPlace[],
  ) => PlanItemDragListProps;
  getSectionDrop: (
    scheduleId: number,
    places: readonly PlanPlace[] | undefined,
  ) => PlanItemSectionDrop;
};

const PlanItemDragContext = createContext<PlanItemDragValue | null>(null);

export const PlanItemDragProvider = PlanItemDragContext.Provider;

export function usePlanItemDrag(): PlanItemDragValue {
  const value = useContext(PlanItemDragContext);
  if (!value) throw new Error("PlanItemDragProvider가 필요해요.");
  return value;
}

const CAPTURE_ROWS_MAX_FRAMES = 8;

export function usePlanItemDragController(roomId: string): PlanItemDragValue {
  const { commitPlanItemDrop } = usePlanItemDropCommit(roomId);
  const prefersReducedMotion = useReducedMotion();

  const [drag, setDrag] = useState<PlanItemDragState | null>(null);
  const dragRef = useRef<PlanItemDragState | null>(null);
  const rowEls = useRef(new Map<number, (HTMLElement | null)[]>());
  const snapshots = useRef(new Map<number, PlanItemRowLayoutSnapshot>());
  const pointerYRef = useRef(0);
  const previewRafRef = useRef(0);
  const captureRafRef = useRef(0);

  const updateDrag = useCallback((next: PlanItemDragState | null) => {
    dragRef.current = next;
    setDrag(next);
  }, []);

  const cancelFrames = useCallback(() => {
    if (previewRafRef.current) cancelAnimationFrame(previewRafRef.current);
    if (captureRafRef.current) cancelAnimationFrame(captureRafRef.current);
    previewRafRef.current = 0;
    captureRafRef.current = 0;
  }, []);

  useEffect(() => cancelFrames, [cancelFrames]);

  const resetDrag = useCallback(() => {
    cancelFrames();
    snapshots.current.clear();
    updateDrag(null);
  }, [cancelFrames, updateDrag]);

  useDragAutoScroll({ active: drag !== null && drag.dropped === null });

  const setOver = useCallback(
    (overScheduleId: number | null, overIndex: number | null) => {
      const current = dragRef.current;
      if (!current || current.dropped) return;
      if (current.overScheduleId === overScheduleId && current.overIndex === overIndex) return;
      updateDrag({ ...current, overScheduleId, overIndex });
    },
    [updateDrag],
  );

  const schedulePreview = useCallback(
    (scheduleId: number) => {
      if (previewRafRef.current) return;
      previewRafRef.current = requestAnimationFrame(() => {
        previewRafRef.current = 0;
        const snapshot = snapshots.current.get(scheduleId);
        if (!snapshot) return;
        setOver(scheduleId, snapshot.isEmpty ? 0 : snapshot.previewIndexAt(pointerYRef.current));
      });
    },
    [setOver],
  );

  const captureTargetRows = useCallback(
    (scheduleId: number, placesLength: number) => {
      if (snapshots.current.has(scheduleId) || captureRafRef.current) return;
      const tryCapture = (frame: number) => {
        captureRafRef.current = 0;
        const els = (rowEls.current.get(scheduleId) ?? []).slice(0, placesLength);
        const rowsReady = placesLength === 0 || els.some((el) => el instanceof HTMLElement);
        if (!rowsReady && frame < CAPTURE_ROWS_MAX_FRAMES) {
          captureRafRef.current = requestAnimationFrame(() => tryCapture(frame + 1));
          return;
        }
        const snapshot = new PlanItemRowLayoutSnapshot();
        snapshot.capture(els);
        snapshots.current.set(scheduleId, snapshot);
        setOver(scheduleId, snapshot.isEmpty ? 0 : snapshot.previewIndexAt(pointerYRef.current));
      };
      tryCapture(0);
    },
    [setOver],
  );

  const dropOn = useCallback(
    (targetScheduleId: number, targetIndex: number, targetPlaces: readonly PlanPlace[] | undefined) => {
      const current = dragRef.current;
      if (!current || current.dropped) return;
      cancelFrames();
      const dropped: PlanItemDragState = {
        ...current,
        overScheduleId: targetScheduleId,
        overIndex: current.overScheduleId === targetScheduleId ? current.overIndex : null,
        dropped: { scheduleId: targetScheduleId, places: targetPlaces },
      };
      const started = commitPlanItemDrop(
        {
          itemId: current.itemId,
          from: { scheduleId: current.sourceScheduleId, index: current.sourceIndex },
          to: { scheduleId: targetScheduleId, index: targetIndex, length: targetPlaces?.length ?? 0 },
        },
        () => {
          if (dragRef.current === dropped) resetDrag();
        },
      );
      if (started) updateDrag(dropped);
      else resetDrag();
    },
    [cancelFrames, commitPlanItemDrop, resetDrag, updateDrag],
  );

  const expandDay = useCallback((scheduleId: number) => {
    usePlanItineraryExpandedStore.getState().setScheduleExpanded(scheduleId, true);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragRef.current?.dropped) return;
    resetDrag();
  }, [resetDrag]);

  const getListProps = useCallback(
    (scheduleId: number, places: readonly PlanPlace[]): PlanItemDragListProps => {
      const previewActive =
        drag !== null &&
        (drag.dropped === null ||
          drag.dropped.scheduleId !== scheduleId ||
          drag.dropped.places === places);
      const isSource = drag?.sourceScheduleId === scheduleId;
      const isOver = drag?.overScheduleId === scheduleId;

      let previewMode: PlanItemRowPreviewMode | null = null;
      if (previewActive && drag && isOver && drag.overIndex !== null) {
        if (isSource) {
          if (drag.overIndex !== drag.sourceIndex && drag.sourceRowHeights.length > 0) {
            previewMode = {
              kind: "reorder",
              fromIndex: drag.sourceIndex,
              previewIndex: drag.overIndex,
              rowHeights: drag.sourceRowHeights,
            };
          }
        } else if (drag.rowHeight > 0) {
          previewMode = { kind: "insert", previewIndex: drag.overIndex, insertHeight: drag.rowHeight };
        }
      }
      const motionEnabled =
        previewActive && (isSource || isOver) && !prefersReducedMotion;

      const handleDragOver = (e: DragEvent<Element>) => {
        const current = dragRef.current;
        if (!current || current.dropped) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        pointerYRef.current = e.clientY;
        if (scheduleId !== current.sourceScheduleId) {
          expandDay(scheduleId);
          captureTargetRows(scheduleId, places.length);
        }
        schedulePreview(scheduleId);
      };

      const handleDragLeave = (e: DragEvent<Element>) => {
        const next = e.relatedTarget;
        if (next instanceof Node && e.currentTarget.contains(next)) return;
        const current = dragRef.current;
        if (!current || current.dropped || current.overScheduleId !== scheduleId) return;
        if (scheduleId !== current.sourceScheduleId) snapshots.current.delete(scheduleId);
        setOver(null, null);
      };

      const handleDrop = (e: DragEvent<Element>) => {
        e.preventDefault();
        const current = dragRef.current;
        if (!current || current.dropped) return;
        const fallbackIndex = scheduleId === current.sourceScheduleId ? current.sourceIndex : 0;
        const targetIndex =
          current.overScheduleId === scheduleId && current.overIndex !== null
            ? current.overIndex
            : fallbackIndex;
        dropOn(scheduleId, targetIndex, places);
      };

      return {
        dropZoneProps: {
          [PLAN_ITEM_ITINERARY_DROP_ZONE_ATTR]: "",
          onDragOver: handleDragOver,
          onDragLeave: handleDragLeave,
          onDrop: handleDrop,
        },
        isItemDragActive: drag !== null,
        reservePaddingBottom: previewMode?.kind === "insert" ? previewMode.insertHeight : 0,
        getRowProps: (index) => {
          const itemId = places[index]?.itemId;
          const isDragging = previewActive && isSource && itemId === drag?.itemId;
          return {
            ref: (el) => {
              const els = rowEls.current.get(scheduleId) ?? [];
              els[index] = el;
              rowEls.current.set(scheduleId, els);
            },
            style: getPlanItemRowReorderStyle({
              translateY: computePlanItemRowPreviewTranslateY(index, previewMode),
              isDragging,
              motionEnabled,
            }),
            placeCardDragProps: {
              displayOrderIndex: computePlanItemRowPreviewOrderIndex(index, places.length, previewMode),
              isDragging,
              dragDisabled: typeof itemId !== "number",
              onDragStart: (e) => {
                if (typeof itemId !== "number") return;
                const target = e.currentTarget;
                if (!(target instanceof HTMLElement)) return;
                beginPlanItemDrag(e.nativeEvent, target, index);
                const source = new PlanItemRowLayoutSnapshot();
                source.capture((rowEls.current.get(scheduleId) ?? []).slice(0, places.length));
                snapshots.current = new Map([[scheduleId, source]]);
                const sourceRowHeights = source.heights();
                updateDrag({
                  itemId,
                  sourceScheduleId: scheduleId,
                  sourceIndex: index,
                  sourceRowHeights,
                  rowHeight: sourceRowHeights[index] ?? target.getBoundingClientRect().height,
                  overScheduleId: scheduleId,
                  overIndex: index,
                  dropped: null,
                });
              },
              onDragEnd: handleDragEnd,
            },
          };
        },
      };
    },
    [
      captureTargetRows,
      drag,
      dropOn,
      expandDay,
      handleDragEnd,
      prefersReducedMotion,
      schedulePreview,
      setOver,
      updateDrag,
    ],
  );

  const getSectionDrop = useCallback(
    (scheduleId: number, places: readonly PlanPlace[] | undefined): PlanItemSectionDrop => {
      const fromItineraryList = (e: DragEvent<Element>) =>
        e.target instanceof Element &&
        e.target.closest(`[${PLAN_ITEM_ITINERARY_DROP_ZONE_ATTR}]`) !== null;

      const isTarget =
        drag !== null &&
        drag.dropped === null &&
        drag.sourceScheduleId !== scheduleId &&
        drag.overScheduleId === scheduleId;

      return {
        isTarget,
        props: {
          onDragOver: (e) => {
            const current = dragRef.current;
            if (!current || current.dropped || current.sourceScheduleId === scheduleId) return;
            if (fromItineraryList(e)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            expandDay(scheduleId);
            setOver(scheduleId, null);
          },
          onDragLeave: (e) => {
            const next = e.relatedTarget;
            if (next instanceof Node && e.currentTarget.contains(next)) return;
            if (dragRef.current?.overScheduleId === scheduleId) setOver(null, null);
          },
          onDrop: (e) => {
            const current = dragRef.current;
            if (!current || current.dropped || current.sourceScheduleId === scheduleId) return;
            if (fromItineraryList(e)) return;
            e.preventDefault();
            dropOn(scheduleId, 0, places);
          },
        },
      };
    },
    [drag, dropOn, expandDay, setOver],
  );

  return useMemo(() => ({ getListProps, getSectionDrop }), [getListProps, getSectionDrop]);
}
