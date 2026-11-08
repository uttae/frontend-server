// @vitest-environment jsdom
import { act, type DragEvent } from "react";
import { beforeEach, expect, it, vi } from "vitest";

import type { RoomSchedule } from "@/lib/api/rooms";
import { hookHarness } from "@/test/hook-harness";

import { usePlanScheduleDayReorder } from "./usePlanScheduleDayReorder";

const move = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
vi.mock("@/hooks/useRooms", () => ({ useMoveRoomSchedule: () => move }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const HEIGHT = 200;
const day = (scheduleId: number, dayNumber: number): RoomSchedule => ({
  scheduleId,
  roomId: "room-a",
  dayNumber,
  date: `2026-10-0${dayNumber}`,
  createdAt: "",
});

function dataTransfer(): DataTransfer {
  const data = new Map<string, string>();
  return {
    setData: (key: string, value: string) => data.set(key, value),
    getData: (key: string) => data.get(key) ?? "",
    setDragImage: () => {},
    get types() {
      return Array.from(data.keys());
    },
  } as unknown as DataTransfer;
}
function section(index: number) {
  const el = document.createElement("section");
  const top = index * HEIGHT;
  el.getBoundingClientRect = () =>
    ({ top, bottom: top + HEIGHT, height: HEIGHT, left: 0, right: 300, width: 300, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
  return el;
}
function dragEvent(transfer: DataTransfer, target: Element, clientY: number) {
  const event = { dataTransfer: transfer, currentTarget: target, target, relatedTarget: null, clientX: 10, clientY, preventDefault: () => {} };
  return { ...event, nativeEvent: event } as unknown as DragEvent<Element>;
}

beforeEach(() => {
  move.mutateAsync.mockReset();
  move.isPending = false;
});

it("keeps the dropped day order on screen until the cache shows it, then draws the cache as is", async () => {
  let finish!: () => void;
  move.mutateAsync.mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
  const schedules = [day(10, 1), day(20, 2), day(30, 3)];
  const hook = hookHarness((list: RoomSchedule[]) => usePlanScheduleDayReorder({ roomId: "room-a", schedules: list }));
  const sections = [0, 1, 2].map(section);
  const transfer = dataTransfer();
  try {
    await hook.render(schedules);
    sections.forEach((el, i) => hook.current.getSectionProps(i).sectionRef(el));
    await act(async () => hook.current.getSectionProps(2).dragHandleProps.onDragStart(dragEvent(transfer, sections[2]!, 500)));
    await act(async () => hook.current.listContainerProps.onDragOver!(dragEvent(transfer, sections[0]!, 50)));
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });

    let dropping!: Promise<void>;
    await act(async () => { dropping = hook.current.listContainerProps.onDrop!(dragEvent(transfer, sections[0]!, 50)); });
    expect(move.mutateAsync).toHaveBeenCalledWith({ roomId: "room-a", scheduleId: 30, targetDayNumber: 1 });
    // drop 바로 뒤의 dragend는 저장 중인 모양을 풀지 않는다
    await act(async () => hook.current.getSectionProps(2).dragHandleProps.onDragEnd());

    // 캐시가 아직 놓기 전 목록이면 놓은 모양(앞 일차를 민 미리보기)을 그대로 그린다
    expect(hook.current.getSectionProps(0).sectionStyle?.transform).toBe(`translateY(${HEIGHT}px)`);

    // onMutate가 캐시를 새 순서로 바꾸면 캐시를 그대로 그린다
    await hook.render([day(30, 1), day(10, 2), day(20, 3)]);
    expect(hook.current.getSectionProps(0).sectionStyle).toBeUndefined();

    await act(async () => {
      finish();
      await dropping;
    });
    expect(hook.current.isDraggingActive).toBe(false);
  } finally {
    await hook.unmount();
  }
});

it("starts the next day drag while the previous one is still saving, and the earlier save does not clear it", async () => {
  let finish!: () => void;
  move.mutateAsync.mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
  const schedules = [day(10, 1), day(20, 2), day(30, 3)];
  const hook = hookHarness((list: RoomSchedule[]) => usePlanScheduleDayReorder({ roomId: "room-a", schedules: list }));
  const sections = [0, 1, 2].map(section);
  const transfer = dataTransfer();
  try {
    await hook.render(schedules);
    sections.forEach((el, i) => hook.current.getSectionProps(i).sectionRef(el));
    await act(async () => hook.current.getSectionProps(2).dragHandleProps.onDragStart(dragEvent(transfer, sections[2]!, 500)));
    await act(async () => hook.current.listContainerProps.onDragOver!(dragEvent(transfer, sections[0]!, 50)));
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });
    let dropping!: Promise<void>;
    await act(async () => { dropping = hook.current.listContainerProps.onDrop!(dragEvent(transfer, sections[0]!, 50)); });

    // 저장 중에도 손잡이를 막지 않는다
    const moved = [day(30, 1), day(10, 2), day(20, 3)];
    await hook.render(moved);
    expect(hook.current.getSectionProps(1).dragHandleProps.dragDisabled).toBe(false);
    await act(async () => hook.current.getSectionProps(1).dragHandleProps.onDragStart(dragEvent(transfer, sections[1]!, 300)));

    // 앞선 저장이 끝나도 지금 끄는 일차는 그대로다
    await act(async () => {
      finish();
      await dropping;
    });
    expect(hook.current.isDraggingActive).toBe(true);
    expect(hook.current.getSectionProps(1).dragHandleProps.isDragging).toBe(true);
  } finally {
    await hook.unmount();
  }
});
