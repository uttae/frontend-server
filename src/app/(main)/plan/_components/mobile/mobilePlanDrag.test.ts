// @vitest-environment jsdom
import { act, type PointerEvent as ReactPointerEvent } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlanItemDrop } from "@/lib/plan/planItemDrop";
import type { PlanPlace } from "@/lib/plan/types";
import { hookHarness } from "@/test/hook-harness";

type Commit = (drop: PlanItemDrop, onSettled: () => void) => boolean;
const commit = vi.hoisted(() => ({ fn: vi.fn<Commit>() }));
vi.mock("@/hooks/usePlanItemDropCommit", () => ({
  usePlanItemDropCommit: () => ({
    commitPlanItemDrop: commit.fn,
  }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const { mobilePlanRowOffset, useMobilePlanDragController, MOBILE_EDIT_ROW_GAP_PX } = await import("./mobilePlanDrag");

const ROW_HEIGHT = 100;
function place(itemId: number): PlanPlace {
  return { id: `item-${itemId}`, itemId, title: `장소 ${itemId}` };
}
function box(top: number, height: number) {
  const el = document.createElement("div");
  el.getBoundingClientRect = () =>
    ({ top, bottom: top + height, height, left: 0, right: 300, width: 300, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
  return el;
}
function pointer(type: string, clientY: number) {
  return Object.assign(new Event(type, { cancelable: true }), { pointerId: 1, clientY });
}

describe("useMobilePlanDragController", () => {
  beforeEach(() => {
    commit.fn.mockReset().mockReturnValue(true);
  });

  function setup() {
    const scrollRef = { current: box(0, 2000) };
    const hook = hookHarness(() => useMobilePlanDragController({ roomId: "room-a", editing: true, scrollRef }));
    const register = (scheduleId: number, places: PlanPlace[], top: number) => {
      hook.current.registerList(scheduleId, box(top, places.length * ROW_HEIGHT));
      places.forEach((_, index) => hook.current.registerRow(scheduleId, index, box(top + index * ROW_HEIGHT, ROW_HEIGHT)));
      hook.current.registerPlaces(scheduleId, places);
    };
    const drag = async (scheduleId: number, index: number, fromY: number, toY: number) => {
      await act(async () =>
        hook.current.startDrag(scheduleId, index, {
          pointerId: 1,
          clientY: fromY,
          preventDefault: () => {},
        } as unknown as ReactPointerEvent<HTMLElement>),
      );
      await act(async () => {
        window.dispatchEvent(pointer("pointermove", toY));
      });
      await act(async () => {
        window.dispatchEvent(pointer("pointerup", toY));
      });
    };
    return { hook, register, drag };
  }

  it("같은 일차에 놓으면 놓기 결정에 시작·놓은 자리를 넘기고, 캐시가 바뀔 때까지 놓은 모양을 둔다", async () => {
    const { hook, register, drag } = setup();
    const day = [place(1), place(2), place(3)];
    try {
      await hook.render(undefined);
      register(10, day, 0);
      await drag(10, 0, 50, 300);

      expect(commit.fn).toHaveBeenCalledExactlyOnceWith(
        { itemId: 1, from: { scheduleId: 10, index: 0 }, to: { scheduleId: 10, index: 2, length: 3 } },
        expect.any(Function),
      );
      // 캐시가 아직 놓기 전 목록이면 손을 뗀 자리의 카드와 밀린 카드를 그대로 그린다 — 원래 자리로 튀지 않는다
      expect(hook.current.rowStyle(10, 0, day)?.transform).toBe("translateY(250px)");
      expect(hook.current.rowStyle(10, 1, day)?.transform).toBe(`translateY(-${ROW_HEIGHT + MOBILE_EDIT_ROW_GAP_PX}px)`);
      // onMutate가 캐시를 새 순서로 바꾸면 캐시를 그대로 그린다
      expect(hook.current.rowStyle(10, 0, [place(2), place(3), place(1)])).toBeUndefined();

      await act(async () => commit.fn.mock.lastCall![1]());
      expect(hook.current.rowStyle(10, 0, day)).toBeUndefined();
      expect(hook.current.dropTargetScheduleId).toBeNull();
    } finally {
      await hook.unmount();
    }
  });

  it("다른 일차에 놓으면 그 일차의 넣을 자리와 길이를 넘긴다", async () => {
    const { hook, register, drag } = setup();
    try {
      await hook.render(undefined);
      register(10, [place(1), place(2)], 0);
      register(20, [place(10), place(11)], 400);
      await drag(10, 1, 150, 470);

      expect(commit.fn).toHaveBeenCalledExactlyOnceWith(
        { itemId: 2, from: { scheduleId: 10, index: 1 }, to: { scheduleId: 20, index: 1, length: 2 } },
        expect.any(Function),
      );
    } finally {
      await hook.unmount();
    }
  });

  it("저장하지 않은 놓기는 바로 푼다", async () => {
    commit.fn.mockReturnValue(false);
    const { hook, register, drag } = setup();
    const day = [place(1), place(2)];
    try {
      await hook.render(undefined);
      register(10, day, 0);
      await drag(10, 0, 50, 190);
      expect(hook.current.rowStyle(10, 0, day)).toBeUndefined();
    } finally {
      await hook.unmount();
    }
  });

  it("앞서 놓은 장소를 저장하는 중에도 새로 끌 수 있고, 앞선 저장이 끝나도 새 드래그를 풀지 않는다", async () => {
    const { hook, register, drag } = setup();
    const day = [place(1), place(2), place(3)];
    try {
      await hook.render(undefined);
      register(10, day, 0);
      await drag(10, 0, 50, 300);
      const [, firstSave] = commit.fn.mock.lastCall!;

      await act(async () =>
        hook.current.startDrag(10, 2, {
          pointerId: 1,
          clientY: 250,
          preventDefault: () => {},
        } as unknown as ReactPointerEvent<HTMLElement>),
      );
      await act(async () => firstSave());
      expect(hook.current.rowStyle(10, 2, day)?.zIndex).toBe(20);
      expect(hook.current.dropTargetScheduleId).toBe(10);
    } finally {
      await hook.unmount();
    }
  });
});

describe("mobilePlanRowOffset", () => {
  const base = { sourceScheduleId: 1, sourceIndex: 1, scheduleId: 1, shift: 72 };

  it("같은 일차에서 뒤로 옮기면 사이 행을 위로 당긴다", () => {
    expect(mobilePlanRowOffset({ ...base, targetScheduleId: 1, targetIndex: 3, index: 2 })).toBe(-72);
    expect(mobilePlanRowOffset({ ...base, targetScheduleId: 1, targetIndex: 3, index: 0 })).toBe(0);
  });

  it("같은 일차에서 앞으로 옮기면 사이 행을 아래로 민다", () => {
    expect(mobilePlanRowOffset({ ...base, sourceIndex: 3, targetScheduleId: 1, targetIndex: 1, index: 2 })).toBe(72);
  });

  it("다른 일차로 옮기면 출발지와 도착지 행을 각각 이동한다", () => {
    expect(mobilePlanRowOffset({ ...base, targetScheduleId: 2, targetIndex: 0, index: 2 })).toBe(-72);
    expect(mobilePlanRowOffset({ ...base, targetScheduleId: 2, targetIndex: 0, scheduleId: 2, index: 0 })).toBe(72);
    expect(mobilePlanRowOffset({ ...base, targetScheduleId: 2, targetIndex: 0, scheduleId: 3, index: 0 })).toBe(0);
  });
});
