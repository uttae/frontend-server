"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

import { usePlanItemDropCommit } from "@/hooks/usePlanItemDropCommit";
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
  /**
   * 놓아서 저장하는 중 — 놓을 때 출발·대상 일차 목록. 캐시(onMutate)가 그 목록을 바꿀 때까지 놓은 모양을 그대로 둔다.
   * 먼저 풀면 캐시가 바뀌기 전 한 프레임 동안 옛 순서가 보인다(캐시 알림은 setTimeout 0 뒤)
   */
  dropped: ReadonlyMap<number, readonly PlanPlace[]> | null;
};

type MobilePlanDragValue = {
  editing: boolean;
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
  /** 그 일차 목록(캐시)의 행 위치 — 놓아서 저장 중이면 캐시가 바뀌기 전까지만 놓은 모양 */
  rowStyle: (scheduleId: number, index: number, places: readonly PlanPlace[]) => CSSProperties | undefined;
};

const MobilePlanDragContext = createContext<MobilePlanDragValue | null>(null);

export const MobilePlanDragProvider = MobilePlanDragContext.Provider;

export function useMobilePlanDrag(): MobilePlanDragValue {
  const value = useContext(MobilePlanDragContext);
  if (!value) throw new Error("MobilePlanDragProvider가 필요해요.");
  return value;
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
 * 놓으면 PC와 같은 놓기 결정(`usePlanItemDropCommit`)이 같은 일차는 순서 변경, 다른 일차는 일차 간 이동으로 저장한다.
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

  const { commitPlanItemDrop } = usePlanItemDropCommit(roomId);

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
      if (!drag || drag.dropped) return;
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

  /** 놓기 — 저장을 시작했으면 캐시가 바뀔 때까지 놓은 모양을 두고, 아니면 바로 푼다 */
  const finishDrag = useCallback(() => {
    const drag = activeRef.current;
    if (!drag || drag.dropped) return;
    const { sourceScheduleId, sourceIndex, targetScheduleId, targetIndex, place } = drag;
    const itemId = place.itemId;
    if (typeof itemId !== "number") {
      updateActive(null);
      return;
    }
    const sourcePlaces = placesBySchedule.current.get(sourceScheduleId) ?? [];
    const targetPlaces = placesBySchedule.current.get(targetScheduleId) ?? [];
    const dropped: ActiveDrag = {
      ...drag,
      dropped: new Map([
        [sourceScheduleId, sourcePlaces],
        [targetScheduleId, targetPlaces],
      ]),
    };
    const started = commitPlanItemDrop(
      {
        itemId,
        from: { scheduleId: sourceScheduleId, index: sourceIndex },
        to: { scheduleId: targetScheduleId, index: targetIndex, length: targetPlaces.length },
      },
      () => {
        if (activeRef.current === dropped) updateActive(null);
      },
    );
    updateActive(started ? dropped : null);
  }, [commitPlanItemDrop, updateActive]);

  const startDrag = useCallback(
    (scheduleId: number, index: number, e: ReactPointerEvent<HTMLElement>) => {
      // 끄는 중이면 다른 손가락은 무시한다. 앞서 놓은 장소를 저장하는 중이면 새 드래그가 그 상태를 덮는다
      if (!editing || (activeRef.current && !activeRef.current.dropped)) return;
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
        dropped: null,
      });
    },
    [editing, toContentY, updateActive],
  );

  // 드래그 중에는 창 전체에서 포인터를 받고, 화면 끝 근처면 자동 스크롤한다(놓은 뒤 저장 중에는 받지 않는다)
  const dragging = active !== null && active.dropped === null;
  useEffect(() => {
    if (!dragging) return;
    function onMove(ev: PointerEvent) {
      if (ev.pointerId !== activeRef.current?.pointerId) return;
      ev.preventDefault();
      updateTarget(ev.clientY);
    }
    function onUp(ev: PointerEvent) {
      if (ev.pointerId !== activeRef.current?.pointerId) return;
      finishDrag();
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
    (scheduleId: number, index: number, places: readonly PlanPlace[]): CSSProperties | undefined => {
      if (!active) return undefined;
      // 저장 중 캐시가 놓을 때 목록에서 바뀌었으면(onMutate) 캐시를 그대로 그린다
      if (active.dropped?.has(scheduleId) && active.dropped.get(scheduleId) !== places) return undefined;
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

  const dropTargetScheduleId = active?.targetScheduleId ?? null;
  return useMemo(
    () => ({
      editing,
      dropTargetScheduleId,
      registerList,
      registerRow,
      registerPlaces,
      startDrag,
      rowStyle,
    }),
    [dropTargetScheduleId, editing, registerList, registerPlaces, registerRow, rowStyle, startDrag],
  );
}
