import type { CSSProperties } from "react";

import { readMainContentScrollTop } from "@/lib/dnd/mainContentScroll";
import { setHtmlDragImageFromPointer } from "@/lib/dnd/setHtmlDragImageFromPointer";

export const PLAN_ITEM_DND_INDEX_MIME = "application/x-plan-item-index";
export const PLAN_ITEM_DND_SCHEDULE_ID_MIME =
  "application/x-plan-item-schedule-id";
export const PLAN_ITEM_DND_ITEM_ID_MIME = "application/x-plan-item-id";

export const PLAN_ITEM_ITINERARY_DROP_ZONE_ATTR = "data-plan-itinerary-drop-zone";

/**
 * 드래그하는 동안 목록이 바뀌면(다른 사람의 변경·재조회) 사용자가 보던 자리와 서버 자리가 달라진다.
 * 재정렬 API는 절대 위치만 받으므로 그대로 보내면 의도와 다른 순서가 저장된다 — 저장하지 않고 알린다.
 */
export const PLAN_ORDER_CHANGED_MESSAGE = "일정이 바뀌어서 옮기지 않았어요. 다시 옮겨 주세요.";

/** 연결이 끊긴 동안이나 놓친 변경을 다시 받는 동안 놓은 경우 */
export const PLAN_ORDER_RESYNCING_MESSAGE =
  "일정을 다시 맞추는 중이라 옮기지 않았어요. 잠시 후 다시 옮겨 주세요.";

/** 드래그를 시작할 때와 놓을 때의 id 순서가 같은지 */
export function sameIdOrder(
  before: readonly unknown[],
  after: readonly unknown[],
): boolean {
  return (
    before.length === after.length && before.every((id, i) => id === after[i])
  );
}

export const PLAN_ITEM_REORDER_ROW_TRANSITION =
  "transform 200ms cubic-bezier(0.2, 0, 0, 1)";

/** 행 bounding rect — `getBoundingClientRect()` 결과와 호환 */
export type PlanItemRowRect = Pick<DOMRect, "top" | "height">;

export function beginPlanItemDrag(
  event: DragEvent,
  source: HTMLElement,
  fromIndex: number,
  meta?: { scheduleId: number; itemId: number },
): void {
  setHtmlDragImageFromPointer(event, source);
  const dataTransfer = event.dataTransfer;
  if (!dataTransfer) return;

  dataTransfer.effectAllowed = "move";
  dataTransfer.setData(PLAN_ITEM_DND_INDEX_MIME, String(fromIndex));
  dataTransfer.setData("text/plain", String(fromIndex));
  if (meta != null) {
    dataTransfer.setData(PLAN_ITEM_DND_SCHEDULE_ID_MIME, String(meta.scheduleId));
    dataTransfer.setData(PLAN_ITEM_DND_ITEM_ID_MIME, String(meta.itemId));
  }
}

function readFiniteDragNumber(dataTransfer: DataTransfer, mime: string): number | null {
  const raw = dataTransfer.getData(mime);
  if (!raw.length) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export function readPlanItemDragScheduleId(
  dataTransfer: DataTransfer,
): number | null {
  return readFiniteDragNumber(dataTransfer, PLAN_ITEM_DND_SCHEDULE_ID_MIME);
}

export function readPlanItemDragItemId(dataTransfer: DataTransfer): number | null {
  return readFiniteDragNumber(dataTransfer, PLAN_ITEM_DND_ITEM_ID_MIME);
}

export function isPlanItemDrag(dataTransfer: DataTransfer): boolean {
  const types = Array.from(dataTransfer.types);
  return (
    types.includes(PLAN_ITEM_DND_SCHEDULE_ID_MIME) ||
    types.includes(PLAN_ITEM_DND_ITEM_ID_MIME) ||
    types.includes(PLAN_ITEM_DND_INDEX_MIME)
  );
}

export function readPlanItemDragIndex(dataTransfer: DataTransfer): number {
  const raw =
    dataTransfer.getData(PLAN_ITEM_DND_INDEX_MIME) ||
    dataTransfer.getData("text/plain");
  return parseInt(raw, 10);
}

export function clampCrossDayTargetOrderIndex(
  index: number,
  placesLength: number,
): number {
  if (placesLength <= 0) return 0;
  return Math.max(0, Math.min(index, placesLength));
}

export type PlanItemCrossDayMoveMutate = (args: {
  roomId: string;
  sourceScheduleId: number;
  itemId: number;
  targetScheduleId: number;
  targetOrderIndex: number;
}) => Promise<unknown>;

export async function executePlanItemCrossDayMove(args: {
  dataTransfer: DataTransfer;
  roomId: string;
  targetScheduleId: number;
  targetOrderIndex: number;
  moveMutate: PlanItemCrossDayMoveMutate;
  onError?: (message: string) => void;
}): Promise<boolean> {
  const sourceScheduleId = readPlanItemDragScheduleId(args.dataTransfer);
  const draggedItemId = readPlanItemDragItemId(args.dataTransfer);

  if (
    sourceScheduleId == null ||
    sourceScheduleId === args.targetScheduleId ||
    typeof draggedItemId !== "number"
  ) {
    return false;
  }

  try {
    await args.moveMutate({
      roomId: args.roomId,
      sourceScheduleId,
      itemId: draggedItemId,
      targetScheduleId: args.targetScheduleId,
      targetOrderIndex: args.targetOrderIndex,
    });
    return true;
  } catch (err) {
    args.onError?.(
      err instanceof Error && err.message.trim()
        ? err.message
        : "다른 일차로 옮기지 못했어요.",
    );
    return true;
  }
}

function snapshotRowRects(
  rowElements: readonly (HTMLElement | null)[],
): PlanItemRowRect[] {
  return rowElements.map((el) => {
    const rect = el?.getBoundingClientRect();
    return { top: rect?.top ?? 0, height: rect?.height ?? 0 };
  });
}

function adjustRowRectsForScrollDelta(
  rects: readonly PlanItemRowRect[],
  scrollDelta: number,
): PlanItemRowRect[] {
  if (scrollDelta === 0) return [...rects];
  return rects.map((r) => ({ top: r.top - scrollDelta, height: r.height }));
}

/** 드래그 시작 시점 행 레이아웃 — transform 적용 전 rect로 preview hit-test */
export class PlanItemRowLayoutSnapshot {
  private rects: PlanItemRowRect[] = [];
  private scrollTopAtCapture = 0;

  capture(rowElements: readonly (HTMLElement | null)[]): void {
    this.rects = snapshotRowRects(rowElements);
    this.scrollTopAtCapture = readMainContentScrollTop();
  }

  clear(): void {
    this.rects = [];
    this.scrollTopAtCapture = 0;
  }

  get isEmpty(): boolean {
    return this.rects.length === 0;
  }

  heights(): readonly number[] {
    return this.rects.map((r) => r.height);
  }

  previewIndexAt(pointerY: number): number {
    const scrollDelta = readMainContentScrollTop() - this.scrollTopAtCapture;
    const rects = adjustRowRectsForScrollDelta(this.rects, scrollDelta);
    return computePreviewIndex(pointerY, rects);
  }
}

/** 포인터 Y가 각 행의 세로 중간선을 넘을 때 삽입 위치(previewIndex)를 계산합니다. */
export function computePreviewIndex(
  pointerY: number,
  rowRects: readonly PlanItemRowRect[],
): number {
  const length = rowRects.length;
  if (length <= 0) return 0;

  for (let i = 0; i < length; i++) {
    const rect = rowRects[i]!;
    const midpoint = rect.top + rect.height / 2;
    if (pointerY < midpoint) {
      return i;
    }
  }

  const lastRect = rowRects[length - 1]!;
  const lastBottom = lastRect.top + lastRect.height;
  if (pointerY >= lastBottom) {
    return length;
  }

  return length - 1;
}

/** 외부(다른 일차)에서 삽입 시 `previewIndex` 이상 행을 아래로 밀기 */
export function computeInsertTranslateY(
  index: number,
  previewIndex: number,
  insertHeight: number,
): number {
  if (insertHeight <= 0 || previewIndex < 0) return 0;
  return index >= previewIndex ? insertHeight : 0;
}

/** 외부 삽입 드래그 중 order badge 1-based 순번 */
export function computeInsertDisplayOrderIndex(
  index: number,
  previewIndex: number,
): number {
  return index >= previewIndex ? index + 2 : index + 1;
}

export type PlanItemRowPreviewMode =
  | {
      kind: "reorder";
      fromIndex: number;
      previewIndex: number;
      rowHeights: readonly number[];
    }
  | {
      kind: "insert";
      previewIndex: number;
      insertHeight: number;
    };

/** 일차 내 reorder·일차 간 insert 공통 translateY */
export function computePlanItemRowPreviewTranslateY(
  index: number,
  mode: PlanItemRowPreviewMode | null,
): number {
  if (mode == null) return 0;
  if (mode.kind === "reorder") {
    return computeRowTranslateY(
      index,
      mode.fromIndex,
      mode.previewIndex,
      mode.rowHeights,
    );
  }
  return computeInsertTranslateY(
    index,
    mode.previewIndex,
    mode.insertHeight,
  );
}

/** 일차 내 reorder·일차 간 insert 공통 order badge */
export function computePlanItemRowPreviewOrderIndex(
  index: number,
  placesLength: number,
  mode: PlanItemRowPreviewMode | null,
): number {
  if (mode == null) return index + 1;
  if (mode.kind === "insert") {
    return computeInsertDisplayOrderIndex(index, mode.previewIndex);
  }
  return computeDisplayOrderIndex(
    index,
    mode.fromIndex,
    mode.previewIndex,
    placesLength,
  );
}

/** `fromIndex` → `previewIndex` 이동 시 i번 행의 translateY(px). */
export function computeRowTranslateY(
  index: number,
  fromIndex: number,
  previewIndex: number,
  rowHeights: readonly number[],
): number {
  if (fromIndex === previewIndex || index === fromIndex) return 0;

  const draggedHeight = rowHeights[fromIndex] ?? 0;

  if (fromIndex < previewIndex) {
    if (index > fromIndex && index <= previewIndex) {
      return -draggedHeight;
    }
    return 0;
  }

  if (fromIndex > previewIndex) {
    if (index >= previewIndex && index < fromIndex) {
      return draggedHeight;
    }
  }

  return 0;
}

/** 드래그 중 order badge에 표시할 1-based 순번 */
export function computeDisplayOrderIndex(
  index: number,
  fromIndex: number,
  previewIndex: number,
  length: number,
): number {
  if (length <= 0) return 1;
  if (fromIndex === previewIndex) return index + 1;

  const order = Array.from({ length }, (_, i) => i);
  const [moved] = order.splice(fromIndex, 1);
  order.splice(previewIndex, 0, moved!);

  return order.indexOf(index) + 1;
}

export function getPlanItemRowReorderStyle({
  translateY,
  isDragging,
  motionEnabled,
}: {
  translateY: number;
  isDragging: boolean;
  motionEnabled: boolean;
}): CSSProperties | undefined {
  if (!motionEnabled && !isDragging) return undefined;

  const style: CSSProperties = {};

  if (isDragging) {
    style.opacity = 0;
  }

  if (motionEnabled) {
    style.transition = PLAN_ITEM_REORDER_ROW_TRANSITION;
    style.willChange = "transform";
    if (translateY !== 0) {
      style.transform = `translateY(${translateY}px)`;
    }
  }

  return Object.keys(style).length > 0 ? style : undefined;
}
