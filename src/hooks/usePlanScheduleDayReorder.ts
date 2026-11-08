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
import { useMoveRoomSchedule } from "@/hooks/useRooms";
import type { RoomSchedule } from "@/lib/api/rooms";
import {
  computeRowTranslateY,
  getPlanItemRowReorderStyle,
  PlanItemRowLayoutSnapshot,
} from "@/lib/plan/planItemReorder";
import {
  beginPlanScheduleDayDrag,
  isPlanScheduleDayDrag,
  readPlanScheduleDayDragIndex,
} from "@/lib/plan/planScheduleDayReorder";

type UsePlanScheduleDayReorderArgs = {
  roomId: string;
  schedules: RoomSchedule[];
};

export function usePlanScheduleDayReorder({
  roomId,
  schedules,
}: UsePlanScheduleDayReorderArgs) {
  const { mutateAsync: moveMutate, isPending: isMovePending } =
    useMoveRoomSchedule();
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  /**
   * 놓아서 저장하는 중 — 놓을 때 일정 목록. 캐시(onMutate)가 목록을 바꿀 때까지 놓은 모양을 그대로 둔다.
   * 먼저 풀면 캐시가 바뀌기 전 한 프레임 동안 옛 순서가 보인다(캐시 알림은 setTimeout 0 뒤)
   */
  const [droppedSchedules, setDroppedSchedules] = useState<RoomSchedule[] | null>(null);
  // 지금 저장 중인 놓기 — dragend는 drop 바로 뒤에 와서 렌더 전 값을 봐야 하고,
  // 앞선 저장이 끝나도 그사이 시작한 새 드래그를 풀지 않도록 놓기마다 다른 값을 둔다
  const pendingDropRef = useRef<symbol | null>(null);

  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const layoutSnapshotRef = useRef(new PlanItemRowLayoutSnapshot());
  const pointerYRef = useRef(0);
  const dragOverRafRef = useRef(0);

  // 저장 중·일차 추가·삭제 중에도 끌 수 있다 — 어긋나도 onSettled 재조회가 서버 순서로 맞춘다.
  // 일차가 1개면 옮길 자리가 없다
  const dragLocked = schedules.length < 2;
  const isDraggingActive = dragFromIndex !== null;

  useDragAutoScroll({ active: isDraggingActive });

  const resetDragPreview = useCallback(() => {
    setDragFromIndex(null);
    setPreviewIndex(null);
    layoutSnapshotRef.current.clear();
  }, []);

  const setSectionRef = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      sectionRefs.current[index] = el;
    },
    [],
  );

  const updatePreviewFromPointer = useCallback(() => {
    if (dragFromIndex === null || layoutSnapshotRef.current.isEmpty) return;

    const nextPreview = layoutSnapshotRef.current.previewIndexAt(
      pointerYRef.current,
    );
    setPreviewIndex((prev) => (prev === nextPreview ? prev : nextPreview));
  }, [dragFromIndex]);

  const schedulePreviewUpdate = useCallback(() => {
    if (dragOverRafRef.current) return;
    dragOverRafRef.current = requestAnimationFrame(() => {
      dragOverRafRef.current = 0;
      updatePreviewFromPointer();
    });
  }, [updatePreviewFromPointer]);

  useEffect(() => {
    return () => {
      if (dragOverRafRef.current) {
        cancelAnimationFrame(dragOverRafRef.current);
      }
    };
  }, []);

  const handleDragStart = useCallback(
    (index: number) => (e: DragEvent<Element>) => {
      if (dragLocked || schedules[index] == null) return;
      // 앞서 놓은 일차를 저장하는 중이면 새 드래그가 그 모양을 덮는다
      pendingDropRef.current = null;
      setDroppedSchedules(null);
      const sectionEl = sectionRefs.current[index];
      if (sectionEl instanceof HTMLElement) {
        beginPlanScheduleDayDrag(e.nativeEvent, sectionEl, index);
      }
      layoutSnapshotRef.current.capture(sectionRefs.current);
      setDragFromIndex(index);
      setPreviewIndex(index);
    },
    [dragLocked, schedules],
  );

  const handleDragEnd = useCallback(() => {
    // 놓아서 저장 중이면 저장이 끝날 때 푼다
    if (pendingDropRef.current) return;
    if (dragOverRafRef.current) {
      cancelAnimationFrame(dragOverRafRef.current);
      dragOverRafRef.current = 0;
    }
    resetDragPreview();
  }, [resetDragPreview]);

  const handleListDragOver = useCallback(
    (e: DragEvent<Element>) => {
      if (dragLocked || dragFromIndex === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      pointerYRef.current = e.clientY;
      schedulePreviewUpdate();
    },
    [dragFromIndex, dragLocked, schedulePreviewUpdate],
  );

  const handleListDragLeave = useCallback(
    (e: DragEvent<Element>) => {
      const next = e.relatedTarget as Node | null;
      if (next && e.currentTarget.contains(next)) return;
      if (dragFromIndex === null) return;
      setPreviewIndex(dragFromIndex);
    },
    [dragFromIndex],
  );

  const handleListDrop = useCallback(
    async (e: DragEvent<Element>) => {
      if (!isPlanScheduleDayDrag(e.dataTransfer)) return;

      e.preventDefault();

      const fromIndex = readPlanScheduleDayDragIndex(e.dataTransfer);
      const toIndex =
        previewIndex ??
        (Number.isFinite(fromIndex) ? fromIndex : null);

      if (
        !Number.isFinite(fromIndex) ||
        fromIndex < 0 ||
        fromIndex >= schedules.length ||
        toIndex === null ||
        toIndex < 0 ||
        toIndex >= schedules.length ||
        fromIndex === toIndex
      ) {
        resetDragPreview();
        return;
      }

      const scheduleId = schedules[fromIndex]?.scheduleId;
      if (typeof scheduleId !== "number") {
        resetDragPreview();
        return;
      }

      const targetDayNumber = toIndex + 1;

      const drop = Symbol("day-drop");
      pendingDropRef.current = drop;
      setDroppedSchedules(schedules);
      try {
        await moveMutate({
          roomId,
          scheduleId,
          targetDayNumber,
        });
      } catch (err) {
        toast.error(
          err instanceof Error && err.message.trim()
            ? err.message
            : "일차 순서를 바꾸지 못했어요.",
        );
      } finally {
        if (pendingDropRef.current === drop) {
          pendingDropRef.current = null;
          setDroppedSchedules(null);
          resetDragPreview();
        }
      }
    },
    [moveMutate, previewIndex, resetDragPreview, roomId, schedules],
  );

  // 저장 중에는 캐시가 놓을 때 목록 그대로인 동안만 놓은 모양을 그린다
  const previewActive = droppedSchedules === null || droppedSchedules === schedules;

  const getSectionProps = useCallback(
    (index: number) => {
      const fromIdx = previewActive ? dragFromIndex : null;
      const previewIdx = previewIndex;
      const snapshot = layoutSnapshotRef.current;

      let translateY = 0;
      if (
        fromIdx !== null &&
        previewIdx !== null &&
        fromIdx !== previewIdx &&
        !snapshot.isEmpty
      ) {
        translateY = computeRowTranslateY(
          index,
          fromIdx,
          previewIdx,
          snapshot.heights(),
        );
      }

      const isDragging = fromIdx === index;

      return {
        sectionRef: setSectionRef(index),
        sectionStyle: getPlanItemRowReorderStyle({
          translateY,
          isDragging,
          motionEnabled: isDraggingActive && previewActive,
        }),
        dragHandleProps: {
          dragDisabled: dragLocked || schedules[index] == null,
          isDragging,
          onDragStart: handleDragStart(index),
          onDragEnd: handleDragEnd,
        },
      };
    },
    [
      dragFromIndex,
      dragLocked,
      handleDragEnd,
      handleDragStart,
      isDraggingActive,
      previewActive,
      previewIndex,
      schedules,
      setSectionRef,
    ],
  );

  const listContainerProps = {
    onDragOver: dragLocked ? undefined : handleListDragOver,
    onDragLeave: dragLocked ? undefined : handleListDragLeave,
    onDrop: dragLocked ? undefined : handleListDrop,
  };

  return {
    getSectionProps,
    listContainerProps,
    isDraggingActive,
    isMovePending,
  };
}
