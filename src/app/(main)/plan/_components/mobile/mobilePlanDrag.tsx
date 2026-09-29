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
import { bucketItemCount } from "@/lib/analytics/context";
import { AnalyticsEvents, trackAnalyticsEvent } from "@/lib/analytics/track";
import { clampCrossDayTargetOrderIndex } from "@/lib/plan/planItemReorder";
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

/** 서버 반영 전 먼저 보여줄 이동 */
export type PendingPlanMove =
  | { kind: "reorder"; scheduleId: number; order: string[] }
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
    const byId = new Map(places.map((p) => [p.id, p]));
    const ordered = pending.order.map((id) => byId.get(id)).filter((p): p is PlanPlace => !!p);
    return ordered.length === places.length ? ordered : places;
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
  const [active, setActiveState] = useState<ActiveDrag | null>(null);
  const [pending, setPending] = useState<PendingPlanMove | null>(null);
  const rafRef = useRef<number | null>(null);

  const { mutateAsync: reorderMutate, isReorderSettling } = useReorderScheduleItem();
  const { mutateAsync: moveMutate, isPending: isMovePending } = useMoveScheduleItemToSchedule();
  const dragDisabled = isReorderSettling || isMovePending || pending !== null;

  const setActive = useCallback((next: ActiveDrag | null) => {
    activeRef.current = next;
    setActiveState(next);
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
      setActive({ ...drag, lastClientY: clientY, dy, targetScheduleId: hit.scheduleId, targetIndex });
    },
    [setActive, toContentY],
  );

  const finishDrag = useCallback(async () => {
    const drag = activeRef.current;
    if (!drag) return;
    setActive(null);
    const { sourceScheduleId, sourceIndex, targetScheduleId, targetIndex, place } = drag;
    const itemId = place.itemId;
    if (typeof itemId !== "number") return;
    const sourcePlaces = placesBySchedule.current.get(sourceScheduleId) ?? [];

    if (targetScheduleId === sourceScheduleId) {
      if (targetIndex === sourceIndex) return;
      const order = sourcePlaces.map((p) => p.id);
      const [moved] = order.splice(sourceIndex, 1);
      order.splice(targetIndex, 0, moved!);
      setPending({ kind: "reorder", scheduleId: sourceScheduleId, order });
      try {
        await reorderMutate({
          roomId,
          scheduleId: sourceScheduleId,
          itemId,
          body: { newOrderIndex: newOrderIndexAfterMove(sourceIndex, targetIndex, sourcePlaces.length) },
        });
        trackAnalyticsEvent(AnalyticsEvents.reorderItinerary, {
          item_count_bucket: bucketItemCount(sourcePlaces.length),
          method: "drag_drop",
        });
      } catch {
        toast.error("순서를 바꾸지 못했어요.");
      } finally {
        setPending(null);
      }
      return;
    }

    const targetLength = placesBySchedule.current.get(targetScheduleId)?.length ?? 0;
    const toIndex = clampCrossDayTargetOrderIndex(targetIndex, targetLength);
    setPending({ kind: "move", place, fromScheduleId: sourceScheduleId, toScheduleId: targetScheduleId, toIndex });
    try {
      await moveMutate({
        roomId,
        sourceScheduleId,
        itemId,
        targetScheduleId,
        targetOrderIndex: toIndex,
      });
    } catch (err) {
      toast.error(
        err instanceof Error && err.message.trim() ? err.message : "다른 일차로 옮기지 못했어요.",
      );
    } finally {
      setPending(null);
    }
  }, [moveMutate, reorderMutate, roomId, setActive]);

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

      setActive({
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
    [dragDisabled, editing, setActive, toContentY],
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
        const speed =
          y < rect.top + AUTO_SCROLL_EDGE_PX
            ? -AUTO_SCROLL_MAX_SPEED_PX * (1 - Math.max(0, y - rect.top) / AUTO_SCROLL_EDGE_PX)
            : y > rect.bottom - AUTO_SCROLL_EDGE_PX
              ? AUTO_SCROLL_MAX_SPEED_PX * (1 - Math.max(0, rect.bottom - y) / AUTO_SCROLL_EDGE_PX)
              : 0;
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
      let offset = 0;
      if (targetScheduleId === sourceScheduleId) {
        if (scheduleId === sourceScheduleId) {
          if (sourceIndex < targetIndex && index > sourceIndex && index <= targetIndex) offset = -shift;
          if (sourceIndex > targetIndex && index >= targetIndex && index < sourceIndex) offset = shift;
        }
      } else {
        if (scheduleId === sourceScheduleId && index > sourceIndex) offset = -shift;
        if (scheduleId === targetScheduleId && index >= targetIndex) offset = shift;
      }
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
