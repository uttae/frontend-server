"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { toast } from "sonner";

import {
  useMoveScheduleItemToSchedule,
  useReorderScheduleItem,
} from "@/hooks/useRooms";
import { useScheduleResyncPending } from "@/hooks/useScheduleResyncPending";
import { bucketItemCount } from "@/lib/analytics/context";
import { AnalyticsEvents, trackAnalyticsEvent } from "@/lib/analytics/track";
import {
  clampCrossDayTargetOrderIndex,
  PLAN_ORDER_RESYNCING_MESSAGE,
} from "@/lib/plan/planItemReorder";
import { newOrderIndexAfterMove } from "@/lib/plan/scheduleItemPlaces";
import type { PlanPlace } from "@/lib/plan/types";

/** 편집 모드 카드 사이 간격(px) — 드래그 중 다른 카드를 밀어낼 거리 */
export const MOBILE_EDIT_ROW_GAP_PX = 8;
/** 대상 일차 판정 여유(px) — 목록 위아래로 이만큼 벗어나도 그 일차로 본다 */
const DAY_HIT_MARGIN_PX = 32;
/** 스크롤 영역 위아래 이 거리 안으로 끌면 자동 스크롤 */
const AUTO_SCROLL_EDGE_PX = 72;
const AUTO_SCROLL_MAX_SPEED_PX = 14;

type RowSnapshot = { center: number; height: number };
type DaySnapshot = { scheduleId: number; top: number; bottom: number; rows: RowSnapshot[] };

type ActiveDrag = {
  pointerId: number;
  sourceScheduleId: number;
  sourceIndex: number;
  place: PlanPlace;
  /** 스크롤 콘텐츠 기준 좌표 */
  days: DaySnapshot[];
  startContentY: number;
  lastClientY: number;
  dy: number;
  targetScheduleId: number;
  targetIndex: number;
};

/** 저장 중인 순서 변경·일차 이동 — 응답 전에 새 자리를 먼저 보여 준다(mutation 요청 값에서 계산) */
export type PendingPlanMove =
  | { kind: "reorder"; scheduleId: number; itemId: number; newOrderIndex: number }
  | { kind: "move"; place: PlanPlace; fromScheduleId: number; toScheduleId: number; toIndex: number };

type MobilePlanDragValue = {
  editing: boolean;
  dragDisabled: boolean;
  pending: PendingPlanMove | null;
  /** 드래그 중 카드가 놓일 일차 — 드래그 중이 아니면 null */
  dropTargetScheduleId: number | null;
  registerList: (scheduleId: number, el: HTMLElement | null) => void;
  registerRow: (scheduleId: number, index: number, el: HTMLElement | null) => void;
  registerPlaces: (scheduleId: number, places: PlanPlace[]) => void;
  startDrag: (
    scheduleId: number,
    index: number,
    e: ReactPointerEvent<HTMLElement>,
  ) => void;
  rowStyle: (scheduleId: number, index: number) => CSSProperties | undefined;
};

const MobilePlanDragContext = createContext<MobilePlanDragValue | null>(null);

export const MobilePlanDragProvider = MobilePlanDragContext.Provider;

export function useMobilePlanDrag(): MobilePlanDragValue {
  const value = useContext(MobilePlanDragContext);
  if (!value) throw new Error("MobilePlanDragProvider가 필요해요.");
  return value;
}

/** 서버 목록에 처리 중인 이동을 반영한 표시용 목록 */
export function applyPendingPlanMove(
  scheduleId: number,
  places: PlanPlace[],
  pending: PendingPlanMove | null,
): PlanPlace[] {
  if (!pending) return places;
  if (pending.kind === "reorder") {
    if (pending.scheduleId !== scheduleId) return places;
    const from = places.findIndex((p) => p.itemId === pending.itemId);
    if (from < 0) return places;
    const next = [...places];
    next.splice(pending.newOrderIndex, 0, ...next.splice(from, 1));
    return next;
  }
  const itemId = pending.place.itemId;
  if (pending.fromScheduleId === scheduleId) {
    return places.filter((p) => p.itemId !== itemId);
  }
  if (pending.toScheduleId === scheduleId && !places.some((p) => p.itemId === itemId)) {
    const next = [...places];
    next.splice(clampCrossDayTargetOrderIndex(pending.toIndex, places.length), 0, pending.place);
    return next;
  }
  return places;
}

type RowOffsetInput = Pick<
  ActiveDrag,
  "sourceScheduleId" | "sourceIndex" | "targetScheduleId" | "targetIndex"
> & { scheduleId: number; index: number; shift: number };

export function mobilePlanRowOffset({
  sourceScheduleId,
  sourceIndex,
  targetScheduleId,
  targetIndex,
  scheduleId,
  index,
  shift,
}: RowOffsetInput): number {
  if (targetScheduleId === sourceScheduleId) {
    if (scheduleId !== sourceScheduleId) return 0;
    if (sourceIndex < targetIndex && index > sourceIndex && index <= targetIndex) return -shift;
    if (sourceIndex > targetIndex && index >= targetIndex && index < sourceIndex) return shift;
    return 0;
  }
  if (scheduleId === sourceScheduleId && index > sourceIndex) return -shift;
  if (scheduleId === targetScheduleId && index >= targetIndex) return shift;
  return 0;
}

function autoScrollSpeed(y: number, top: number, bottom: number): number {
  if (y < top + AUTO_SCROLL_EDGE_PX) {
    return -AUTO_SCROLL_MAX_SPEED_PX * (1 - Math.max(0, y - top) / AUTO_SCROLL_EDGE_PX);
  }
  if (y > bottom - AUTO_SCROLL_EDGE_PX) {
    return AUTO_SCROLL_MAX_SPEED_PX * (1 - Math.max(0, bottom - y) / AUTO_SCROLL_EDGE_PX);
  }
  return 0;
}

/**
 * 모바일 일정 순서 편집 드래그 — 모든 일차의 카드를 한 번에 다루고, 다른 일차로도 옮길 수 있다.
 * 같은 일차는 순서 변경, 다른 일차는 일차 간 이동 API로 저장한다.
 */
export function useMobilePlanDragController({
  roomId,
  editing,
  scrollRef,
}: {
  roomId: string;
  editing: boolean;
  scrollRef: RefObject<HTMLElement | null>;
}): MobilePlanDragValue {
  const lists = useRef(new Map<number, HTMLElement>());
  const rows = useRef(new Map<number, Map<number, HTMLElement>>());
  const placesBySchedule = useRef(new Map<number, PlanPlace[]>());
  const activeRef = useRef<ActiveDrag | null>(null);
  const [active, setActive] = useState<ActiveDrag | null>(null);
  const rafRef = useRef<number | null>(null);

  const {
    mutateAsync: reorderMutate,
    isPending: isReorderPending,
    variables: reorderVariables,
  } = useReorderScheduleItem();
  const {
    mutateAsync: moveMutate,
    isPending: isMovePending,
    variables: moveVariables,
  } = useMoveScheduleItemToSchedule();
  const scheduleResyncPending = useScheduleResyncPending(roomId);
  const dragDisabled = isReorderPending || isMovePending || scheduleResyncPending;
  // 결과가 편집 목록에만 보이므로 캐시를 고치지 않고, 저장하는 동안 요청 값으로 새 자리를 그린다
  const pending: PendingPlanMove | null =
    isReorderPending && reorderVariables
      ? {
          kind: "reorder",
          scheduleId: reorderVariables.scheduleId,
          itemId: reorderVariables.itemId,
          newOrderIndex: reorderVariables.body.newOrderIndex,
        }
      : isMovePending && moveVariables?.place
        ? {
            kind: "move",
            place: moveVariables.place,
            fromScheduleId: moveVariables.sourceScheduleId,
            toScheduleId: moveVariables.targetScheduleId,
            toIndex: moveVariables.targetOrderIndex,
          }
        : null;

  const updateActive = useCallback((next: ActiveDrag | null) => {
    activeRef.current = next;
    setActive(next);
  }, []);

  const registerList = useCallback((scheduleId: number, el: HTMLElement | null) => {
    if (el) lists.current.set(scheduleId, el);
    else lists.current.delete(scheduleId);
  }, []);

  const registerRow = useCallback((scheduleId: number, index: number, el: HTMLElement | null) => {
    let byIndex = rows.current.get(scheduleId);
    if (!byIndex) {
      byIndex = new Map();
      rows.current.set(scheduleId, byIndex);
    }
    if (el) byIndex.set(index, el);
    else byIndex.delete(index);
  }, []);

  const registerPlaces = useCallback((scheduleId: number, places: PlanPlace[]) => {
    placesBySchedule.current.set(scheduleId, places);
  }, []);

  /** 뷰포트 y → 스크롤 콘텐츠 y */
  const toContentY = useCallback(
    (clientY: number) => {
      const scroll = scrollRef.current;
      if (!scroll) return clientY;
      return clientY - scroll.getBoundingClientRect().top + scroll.scrollTop;
    },
    [scrollRef],
  );

  const updateTarget = useCallback(
    (clientY: number) => {
      const drag = activeRef.current;
      if (!drag) return;
      const dy = toContentY(clientY) - drag.startContentY;
      const sourceDay = drag.days.find((d) => d.scheduleId === drag.sourceScheduleId);
      const sourceRow = sourceDay?.rows[drag.sourceIndex];
      if (!sourceRow) return;
      const center = sourceRow.center + dy;

      const hit =
        drag.days.find((d) => center >= d.top - DAY_HIT_MARGIN_PX && center <= d.bottom + DAY_HIT_MARGIN_PX) ??
        drag.days.reduce((best, d) => {
          const dist = (day: DaySnapshot) =>
            center < day.top ? day.top - center : Math.max(0, center - day.bottom);
          return dist(d) < dist(best) ? d : best;
        });
      const sameDay = hit.scheduleId === drag.sourceScheduleId;
      let targetIndex = 0;
      hit.rows.forEach((row, i) => {
        if (sameDay && i === drag.sourceIndex) return;
        if (row.center < center) targetIndex += 1;
      });
      updateActive({ ...drag, lastClientY: clientY, dy, targetScheduleId: hit.scheduleId, targetIndex });
    },
    [toContentY, updateActive],
  );

  const finishDrag = useCallback(async () => {
    const drag = activeRef.current;
    if (!drag) return;
    updateActive(null);
    const { sourceScheduleId, sourceIndex, targetScheduleId, targetIndex, place } = drag;
    const itemId = place.itemId;
    if (typeof itemId !== "number") return;
    const sourcePlaces = placesBySchedule.current.get(sourceScheduleId) ?? [];

    // 드래그하는 동안 연결이 끊겼으면 놓은 자리를 서버 순서로 확인할 수 없다
    if (scheduleResyncPending) {
      toast.error(PLAN_ORDER_RESYNCING_MESSAGE);
      return;
    }

    if (targetScheduleId === sourceScheduleId) {
      if (targetIndex === sourceIndex) return;
      try {
        await reorderMutate({
          roomId,
          scheduleId: sourceScheduleId,
          itemId,
          body: { newOrderIndex: newOrderIndexAfterMove(sourceIndex, targetIndex, sourcePlaces.length) },
        });
        trackAnalyticsEvent(AnalyticsEvents.reorderItinerary, {
          room_id: roomId,
          item_count_bucket: bucketItemCount(sourcePlaces.length),
          method: "drag_drop",
        });
      } catch {
        toast.error("순서를 바꾸지 못했어요.");
      }
      return;
    }

    const targetLength = placesBySchedule.current.get(targetScheduleId)?.length ?? 0;
    try {
      await moveMutate({
        roomId,
        sourceScheduleId,
        itemId,
        targetScheduleId,
        targetOrderIndex: clampCrossDayTargetOrderIndex(targetIndex, targetLength),
        place,
      });
    } catch (err) {
      toast.error(
        err instanceof Error && err.message.trim() ? err.message : "다른 일차로 옮기지 못했어요.",
      );
    }
  }, [moveMutate, reorderMutate, roomId, scheduleResyncPending, updateActive]);

  const startDrag = useCallback(
    (scheduleId: number, index: number, e: ReactPointerEvent<HTMLElement>) => {
      if (!editing || dragDisabled || activeRef.current) return;
      const place = placesBySchedule.current.get(scheduleId)?.[index];
      if (!place || typeof place.itemId !== "number") return;
      e.preventDefault();

      const days: DaySnapshot[] = [...lists.current.entries()]
        .map(([sid, listEl]) => {
          const rect = listEl.getBoundingClientRect();
          const byIndex = rows.current.get(sid) ?? new Map<number, HTMLElement>();
          const dayRows = [...byIndex.entries()]
            .sort(([a], [b]) => a - b)
            .map(([, el]) => {
              const r = el.getBoundingClientRect();
              return { center: toContentY(r.top) + r.height / 2, height: r.height };
            });
          return { scheduleId: sid, top: toContentY(rect.top), bottom: toContentY(rect.bottom), rows: dayRows };
        })
        .sort((a, b) => a.top - b.top);

      updateActive({
        pointerId: e.pointerId,
        sourceScheduleId: scheduleId,
        sourceIndex: index,
        place,
        days,
        startContentY: toContentY(e.clientY),
        lastClientY: e.clientY,
        dy: 0,
        targetScheduleId: scheduleId,
        targetIndex: index,
      });
    },
    [dragDisabled, editing, toContentY, updateActive],
  );

  // 드래그 중에는 창 전체에서 포인터를 받고, 화면 끝 근처면 자동 스크롤한다
  const dragging = active !== null;
  useEffect(() => {
    if (!dragging) return;
    function onMove(ev: PointerEvent) {
      if (ev.pointerId !== activeRef.current?.pointerId) return;
      ev.preventDefault();
      updateTarget(ev.clientY);
    }
    function onUp(ev: PointerEvent) {
      if (ev.pointerId !== activeRef.current?.pointerId) return;
      void finishDrag();
    }
    function tick() {
      const drag = activeRef.current;
      const scroll = scrollRef.current;
      if (drag && scroll) {
        const rect = scroll.getBoundingClientRect();
        const y = drag.lastClientY;
        const speed = autoScrollSpeed(y, rect.top, rect.bottom);
        if (speed !== 0) {
          const before = scroll.scrollTop;
          scroll.scrollTop += speed;
          if (scroll.scrollTop !== before) updateTarget(y);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [dragging, finishDrag, scrollRef, updateTarget]);

  const rowStyle = useCallback(
    (scheduleId: number, index: number): CSSProperties | undefined => {
      if (!active) return undefined;
      const { sourceScheduleId, sourceIndex, targetScheduleId, targetIndex, dy, days } = active;
      if (scheduleId === sourceScheduleId && index === sourceIndex) {
        return { transform: `translateY(${dy}px)`, position: "relative", zIndex: 20 };
      }
      const height = days.find((d) => d.scheduleId === sourceScheduleId)?.rows[sourceIndex]?.height ?? 0;
      const shift = height + MOBILE_EDIT_ROW_GAP_PX;
      const offset = mobilePlanRowOffset({
        sourceScheduleId,
        sourceIndex,
        targetScheduleId,
        targetIndex,
        scheduleId,
        index,
        shift,
      });
      return { transform: `translateY(${offset}px)`, transition: "transform 150ms ease-out", position: "relative" };
    },
    [active],
  );

  return {
    editing,
    dragDisabled,
    pending,
    dropTargetScheduleId: active?.targetScheduleId ?? null,
    registerList,
    registerRow,
    registerPlaces,
    startDrag,
    rowStyle,
  };
}
