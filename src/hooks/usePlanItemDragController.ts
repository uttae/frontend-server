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

/** 드래그 한 번(페이지 전체에 걸침)의 상태 — 페이지에 한 벌만 둔다 */
type PlanItemDragState = {
  itemId: number;
  sourceScheduleId: number;
  /** 드래그를 시작할 때 출발 일차에서의 자리 */
  sourceIndex: number;
  /** 드래그를 시작할 때 잰 출발 일차 행 높이 — 같은 일차 미리보기에서 밀어낼 거리 */
  sourceRowHeights: readonly number[];
  /** 출발 행 높이 — 다른 일차 목록에 넣을 틈의 높이 */
  rowHeight: number;
  /** 지금 놓을 일차(목록·헤더 위). 어느 일차 위도 아니면 null */
  overScheduleId: number | null;
  /** 목록 위면 미리보기 자리, 헤더·접힌 일차 위면 null(맨 앞에 넣는다) */
  overIndex: number | null;
  /**
   * 놓아서 저장하는 중 — 놓을 때 대상 일차 목록. 캐시(onMutate)가 그 목록을 바꿀 때까지 놓은 모양을 그대로 둔다.
   * 미리보기를 먼저 풀면 캐시가 바뀌기 전 한 프레임 동안 옛 순서가 보인다(캐시 알림은 setTimeout 0 뒤)
   */
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
  /** 목록 놓을 영역 */
  dropZoneProps: DropHandlers & { [PLAN_ITEM_ITINERARY_DROP_ZONE_ATTR]: "" };
  /** 어느 일차에서든 장소를 끄는 중 — 빈 일차에 놓을 자리를 만든다 */
  isItemDragActive: boolean;
  /** 이 목록에 넣을 틈만큼 아래 여백 — 밀린 행이 다음 요소를 덮지 않게 */
  reservePaddingBottom: number;
  getRowProps: (index: number) => PlanItemDragRowProps;
};

export type PlanItemSectionDrop = {
  /** 일차 헤더·접힌 일차 놓을 영역 */
  props: DropHandlers;
  /** 다른 일차의 장소를 이 일차 위로 끌고 있다 — 헤더를 강조한다 */
  isTarget: boolean;
};

export type PlanItemDragValue = {
  /** 일차 목록 하나 — 목록이 캐시 목록을 넘긴다 */
  getListProps: (
    scheduleId: number,
    places: readonly PlanPlace[],
  ) => PlanItemDragListProps;
  /** 일차 헤더·접힌 일차 — 놓으면 그 일차 맨 앞에 넣는다 */
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

/** 목록이 펼쳐진 직후에는 행이 아직 없을 수 있어 몇 프레임 기다렸다 잰다 */
const CAPTURE_ROWS_MAX_FRAMES = 8;

/**
 * PC 일정 장소 드래그(HTML5 DnD) — 모든 일차의 장소 카드를 한 곳에서 다룬다.
 * 무엇을 어디로 끄는지·헤더 강조·미리보기 위치·잠금을 갖고, 놓으면 놓기 결정(`usePlanItemDropCommit`)에 넘긴다.
 * API·캐시는 직접 만지지 않는다.
 */
export function usePlanItemDragController(roomId: string): PlanItemDragValue {
  const { commitPlanItemDrop } = usePlanItemDropCommit(roomId);
  const prefersReducedMotion = useReducedMotion();

  const [drag, setDrag] = useState<PlanItemDragState | null>(null);
  // dragend는 drop 바로 뒤에 와서 렌더 전 값을 봐야 한다 — 핸들러는 ref로 읽는다
  const dragRef = useRef<PlanItemDragState | null>(null);
  const rowEls = useRef(new Map<number, (HTMLElement | null)[]>());
  /** 드래그 시작(출발)·처음 올라온 때(대상) 잰 행 위치 — transform 전 위치로 미리보기 자리를 정한다(핸들러에서만 읽는다) */
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

  /** 다른 일차 목록에 처음 올라왔을 때 그 목록의 행 위치를 잰다(펼쳐지는 중이면 행이 생길 때까지) */
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

  /** 놓기 — 저장을 시작했으면 캐시가 바뀔 때까지 놓은 모양을 두고, 아니면 바로 푼다 */
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
    // 놓아서 저장 중이면 저장이 끝날 때 푼다. 목록 밖에 놓았거나 취소(Esc)했으면 여기서 푼다
    if (dragRef.current?.dropped) return;
    resetDrag();
  }, [resetDrag]);

  const getListProps = useCallback(
    (scheduleId: number, places: readonly PlanPlace[]): PlanItemDragListProps => {
      // 저장 중에는 캐시가 놓을 때 목록 그대로인 동안만 놓은 모양을 그린다
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
        // 다른 일차 목록은 다시 올라오면 새로 잰다(그사이 펼침·스크롤이 바뀐다)
        if (scheduleId !== current.sourceScheduleId) snapshots.current.delete(scheduleId);
        setOver(null, null);
      };

      const handleDrop = (e: DragEvent<Element>) => {
        e.preventDefault();
        const current = dragRef.current;
        if (!current || current.dropped) return;
        const targetIndex =
          current.overScheduleId === scheduleId && current.overIndex !== null
            ? current.overIndex
            : scheduleId === current.sourceScheduleId
              ? current.sourceIndex
              : 0;
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
              // 앞서 놓은 장소를 저장하는 중이어도 새로 끌 수 있다 — 새 드래그가 그 상태를 덮는다
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
      // 목록 안의 이벤트는 목록이 처리한다(이벤트가 섹션까지 올라온다)
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
