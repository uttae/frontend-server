// @vitest-environment jsdom
import { act, type DragEvent } from "react";
import { beforeEach, expect, it, vi } from "vitest";

import type { PlanItemDrop } from "@/lib/plan/planItemDrop";
import type { PlanPlace } from "@/lib/plan/types";
import { hookHarness } from "@/test/hook-harness";

import { usePlanItemDragController } from "./usePlanItemDragController";

type Commit = (drop: PlanItemDrop, onSettled: () => void) => boolean;
const commit = vi.hoisted(() => ({ fn: vi.fn<Commit>() }));
vi.mock("@/hooks/usePlanItemDropCommit", () => ({
  usePlanItemDropCommit: () => ({ commitPlanItemDrop: commit.fn }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const ROW_HEIGHT = 100;
const place = (itemId: number): PlanPlace => ({ id: `item-${itemId}`, itemId, title: `장소 ${itemId}` });

function dataTransfer(): DataTransfer {
  const data = new Map<string, string>();
  return {
    setData: (key: string, value: string) => data.set(key, value),
    getData: (key: string) => data.get(key) ?? "",
    setDragImage: () => {},
    dropEffect: "none",
    effectAllowed: "all",
    get types() {
      return Array.from(data.keys());
    },
  } as unknown as DataTransfer;
}

/** 목록 하나의 행 — `top`부터 100px씩 쌓인다 */
function rows(count: number, top = 0) {
  return Array.from({ length: count }, (_, index) => {
    const row = document.createElement("div");
    const y = top + index * ROW_HEIGHT;
    row.getBoundingClientRect = () =>
      ({ top: y, bottom: y + ROW_HEIGHT, height: ROW_HEIGHT, left: 0, right: 200, width: 200, x: 0, y, toJSON: () => ({}) }) as DOMRect;
    return row;
  });
}

function dragEvent(transfer: DataTransfer, target: Element, clientY: number) {
  const event = { dataTransfer: transfer, currentTarget: target, target, relatedTarget: null, clientX: 10, clientY, preventDefault: () => {} };
  return { ...event, nativeEvent: event } as unknown as DragEvent<Element>;
}

const nextFrame = () => act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });

function renderController() {
  return hookHarness((roomId: string) => usePlanItemDragController(roomId));
}

beforeEach(() => {
  commit.fn.mockReset().mockReturnValue(true);
});

it("saves the dragged item at the dropped index even when the day's list changed during the drag", async () => {
  const hook = renderController();
  const day = [place(1), place(2)];
  const els = rows(2);
  const transfer = dataTransfer();
  try {
    await hook.render("room-a");
    els.forEach((el, i) => hook.current.getListProps(10, day).getRowProps(i).ref(el));
    await act(async () => hook.current.getListProps(10, day).getRowProps(0).placeCardDragProps.onDragStart(dragEvent(transfer, els[0]!, 10)));
    await act(async () => hook.current.getListProps(10, day).dropZoneProps.onDragOver(dragEvent(transfer, els[0]!, 190)));
    await nextFrame();
    // 드래그하는 동안 다른 사람이 맨 앞에 장소를 추가했다 — 놓은 자리(몇 번째) 그대로 저장한다
    const changed = [place(3), ...day];
    await act(async () => hook.current.getListProps(10, changed).dropZoneProps.onDrop(dragEvent(transfer, els[0]!, 190)));

    expect(commit.fn).toHaveBeenCalledExactlyOnceWith(
      { itemId: 1, from: { scheduleId: 10, index: 0 }, to: { scheduleId: 10, index: 1, length: 3 } },
      expect.any(Function),
    );
  } finally {
    await hook.unmount();
  }
});

it("keeps the dropped order on screen until the cache shows it, then draws the cache as is", async () => {
  const hook = renderController();
  const day = [place(1), place(2), place(3)];
  const els = rows(3);
  const transfer = dataTransfer();
  try {
    await hook.render("room-a");
    els.forEach((el, i) => hook.current.getListProps(10, day).getRowProps(i).ref(el));
    await act(async () => hook.current.getListProps(10, day).getRowProps(0).placeCardDragProps.onDragStart(dragEvent(transfer, els[0]!, 10)));
    await act(async () => hook.current.getListProps(10, day).dropZoneProps.onDragOver(dragEvent(transfer, els[0]!, 290)));
    await nextFrame();
    await act(async () => hook.current.getListProps(10, day).dropZoneProps.onDrop(dragEvent(transfer, els[0]!, 290)));
    // drop 바로 뒤의 dragend는 저장 중인 모양을 풀지 않는다
    await act(async () => hook.current.getListProps(10, day).getRowProps(0).placeCardDragProps.onDragEnd());

    // 캐시가 아직 놓기 전 목록이면 놓은 모양(뒤 행을 당긴 미리보기)을 그대로 그린다 — 원래 자리로 튀지 않는다
    const before = hook.current.getListProps(10, day);
    expect(before.getRowProps(1).style?.transform).toBe(`translateY(-${ROW_HEIGHT}px)`);
    expect(before.getRowProps(0).placeCardDragProps.isDragging).toBe(true);

    // onMutate가 캐시를 새 순서로 바꾸면 캐시를 그대로 그린다
    const after = hook.current.getListProps(10, [place(2), place(3), place(1)]);
    expect(after.getRowProps(0).style?.transform).toBeUndefined();
    expect(after.getRowProps(2).placeCardDragProps.isDragging).toBe(false);

    // 저장이 끝나면 드래그 상태를 비운다
    const [, onSettled] = commit.fn.mock.lastCall!;
    await act(async () => onSettled());
    expect(hook.current.getListProps(10, day).isItemDragActive).toBe(false);
  } finally {
    await hook.unmount();
  }
});

it("moves to another day's list at the previewed index, and to the front when dropped on its header", async () => {
  const hook = renderController();
  const day1 = [place(1), place(2)];
  const day2 = [place(10), place(11)];
  const day1Rows = rows(2);
  const day2Rows = rows(2, 400);
  const transfer = dataTransfer();
  try {
    await hook.render("room-a");
    day1Rows.forEach((el, i) => hook.current.getListProps(10, day1).getRowProps(i).ref(el));
    day2Rows.forEach((el, i) => hook.current.getListProps(20, day2).getRowProps(i).ref(el));
    await act(async () => hook.current.getListProps(10, day1).getRowProps(1).placeCardDragProps.onDragStart(dragEvent(transfer, day1Rows[1]!, 110)));
    await act(async () => hook.current.getListProps(20, day2).dropZoneProps.onDragOver(dragEvent(transfer, day2Rows[1]!, 520)));
    await nextFrame();

    // 대상 일차 헤더를 강조하고, 넣을 자리부터 아래로 민다
    expect(hook.current.getSectionDrop(20, day2).isTarget).toBe(true);
    const target = hook.current.getListProps(20, day2);
    expect(target.getRowProps(0).style?.transform).toBeUndefined();
    expect(target.getRowProps(1).style?.transform).toBe(`translateY(${ROW_HEIGHT}px)`);
    expect(target.reservePaddingBottom).toBe(ROW_HEIGHT);

    await act(async () => target.dropZoneProps.onDrop(dragEvent(transfer, day2Rows[1]!, 520)));
    expect(commit.fn).toHaveBeenLastCalledWith(
      { itemId: 2, from: { scheduleId: 10, index: 1 }, to: { scheduleId: 20, index: 1, length: 2 } },
      expect.any(Function),
    );
    // 출발 일차는 저장 중에도 끈 카드 자리를 비워 둔다(캐시에서 빠지면 그대로 사라진다)
    expect(hook.current.getListProps(10, day1).getRowProps(1).placeCardDragProps.isDragging).toBe(true);

    await act(async () => commit.fn.mock.lastCall![1]());
    await act(async () => hook.current.getListProps(10, day1).getRowProps(0).placeCardDragProps.onDragStart(dragEvent(transfer, day1Rows[0]!, 10)));
    const header = document.createElement("header");
    const section = hook.current.getSectionDrop(20, day2);
    await act(async () => section.props.onDragOver(dragEvent(transfer, header, 300)));
    await act(async () => section.props.onDrop(dragEvent(transfer, header, 300)));
    expect(commit.fn).toHaveBeenLastCalledWith(
      { itemId: 1, from: { scheduleId: 10, index: 0 }, to: { scheduleId: 20, index: 0, length: 2 } },
      expect.any(Function),
    );
  } finally {
    await hook.unmount();
  }
});

it("clears the preview right away when the drop is not saved", async () => {
  commit.fn.mockReturnValue(false);
  const hook = renderController();
  const day = [place(1), place(2)];
  const els = rows(2);
  const transfer = dataTransfer();
  try {
    await hook.render("room-a");
    els.forEach((el, i) => hook.current.getListProps(10, day).getRowProps(i).ref(el));
    await act(async () => hook.current.getListProps(10, day).getRowProps(0).placeCardDragProps.onDragStart(dragEvent(transfer, els[0]!, 10)));
    await act(async () => hook.current.getListProps(10, day).dropZoneProps.onDrop(dragEvent(transfer, els[0]!, 190)));
    expect(hook.current.getListProps(10, day).isItemDragActive).toBe(false);
  } finally {
    await hook.unmount();
  }
});

it("starts the next drag while the previous drop is still saving, and the earlier save does not clear it", async () => {
  const hook = renderController();
  const day = [place(1), place(2), place(3)];
  const els = rows(3);
  const transfer = dataTransfer();
  try {
    await hook.render("room-a");
    els.forEach((el, i) => hook.current.getListProps(10, day).getRowProps(i).ref(el));
    // 첫 장소를 놓아 저장 중이다(손잡이는 막지 않는다)
    await act(async () => hook.current.getListProps(10, day).getRowProps(0).placeCardDragProps.onDragStart(dragEvent(transfer, els[0]!, 10)));
    await act(async () => hook.current.getListProps(10, day).dropZoneProps.onDrop(dragEvent(transfer, els[0]!, 190)));
    const [, firstSave] = commit.fn.mock.lastCall!;
    expect(hook.current.getListProps(10, day).getRowProps(1).placeCardDragProps.dragDisabled).toBe(false);

    // 저장이 끝나기 전에 다음 장소를 끈다
    await act(async () => hook.current.getListProps(10, day).getRowProps(2).placeCardDragProps.onDragStart(dragEvent(transfer, els[2]!, 250)));
    expect(hook.current.getListProps(10, day).getRowProps(2).placeCardDragProps.isDragging).toBe(true);
    await act(async () => firstSave());
    expect(hook.current.getListProps(10, day).isItemDragActive).toBe(true);

    await act(async () => hook.current.getListProps(10, day).dropZoneProps.onDrop(dragEvent(transfer, els[0]!, 10)));
    expect(commit.fn).toHaveBeenLastCalledWith(
      expect.objectContaining({ itemId: 3, from: { scheduleId: 10, index: 2 } }),
      expect.any(Function),
    );
  } finally {
    await hook.unmount();
  }
});
