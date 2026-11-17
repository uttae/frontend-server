import { describe, expect, it } from "vitest";

import type { RoomSchedule } from "@/lib/api/rooms/schedules";
import {
  insertPlanPlace,
  movePlanPlaceWithinDay,
  moveRoomScheduleToDay,
  removePlanPlace,
} from "@/lib/plan/planListMove";
import type { PlanPlace } from "@/lib/plan/types";

const place = (itemId: number): PlanPlace => ({ id: `item-${itemId}`, itemId, title: `장소 ${itemId}` });
const ids = (places: PlanPlace[] | undefined) => places?.map((p) => p.itemId);

describe("movePlanPlaceWithinDay", () => {
  const day = [place(1), place(2), place(3), place(4)];

  it("옮긴 뒤 목록의 자리로 넣는다 — 서버 순서 API의 newOrderIndex와 같은 뜻", () => {
    expect(ids(movePlanPlaceWithinDay(day, 1, 2))).toEqual([2, 3, 1, 4]);
    expect(ids(movePlanPlaceWithinDay(day, 4, 0))).toEqual([4, 1, 2, 3]);
  });

  it("목록 밖 자리는 끝으로 붙인다", () => {
    expect(ids(movePlanPlaceWithinDay(day, 2, 99))).toEqual([1, 3, 4, 2]);
  });

  it("원래 목록을 바꾸지 않는다", () => {
    movePlanPlaceWithinDay(day, 1, 3);
    expect(ids(day)).toEqual([1, 2, 3, 4]);
  });

  it("목록에 없는 장소면 바꾸지 않는다(undefined)", () => {
    expect(movePlanPlaceWithinDay(day, 99, 0)).toBeUndefined();
  });
});

describe("removePlanPlace · insertPlanPlace (일차 간 이동)", () => {
  const day1 = [place(1), place(2), place(3)];
  const day2 = [place(10), place(11)];

  it("출발 일차에서 빼고 대상 일차의 자리에 넣는다", () => {
    expect(ids(removePlanPlace(day1, 2))).toEqual([1, 3]);
    expect(ids(insertPlanPlace(day2, place(2), 1))).toEqual([10, 2, 11]);
  });

  it("대상 일차 끝 뒤 자리는 끝으로 붙인다", () => {
    expect(ids(insertPlanPlace(day2, place(2), 5))).toEqual([10, 11, 2]);
  });

  it("빈 일차에도 넣는다", () => {
    expect(ids(insertPlanPlace([], place(2), 0))).toEqual([2]);
  });

  it("대상 일차에 이미 있으면 두 번 넣지 않는다", () => {
    expect(ids(insertPlanPlace([place(2), place(10)], place(2), 1))).toEqual([10, 2]);
  });

  it("출발 일차에 없으면 바꾸지 않는다(undefined)", () => {
    expect(removePlanPlace(day1, 99)).toBeUndefined();
  });
});

describe("moveRoomScheduleToDay", () => {
  const schedule = (scheduleId: number, dayNumber: number, date: string): RoomSchedule => ({
    scheduleId,
    roomId: "room",
    dayNumber,
    date,
    createdAt: "",
  });
  const schedules = [
    schedule(30, 3, "2026-10-03"),
    schedule(10, 1, "2026-10-01"),
    schedule(20, 2, "2026-10-02"),
  ];

  it("일차를 옮기고 dayNumber·date를 새 자리대로 다시 매긴다 — 날짜는 자리에 남는다", () => {
    expect(moveRoomScheduleToDay(schedules, 30, 1)).toEqual([
      schedule(30, 1, "2026-10-01"),
      schedule(10, 2, "2026-10-02"),
      schedule(20, 3, "2026-10-03"),
    ]);
  });

  it("뒤로 옮겨도 같다", () => {
    expect(
      moveRoomScheduleToDay(schedules, 10, 3)?.map((s) => [s.scheduleId, s.dayNumber, s.date]),
    ).toEqual([
      [20, 1, "2026-10-01"],
      [30, 2, "2026-10-02"],
      [10, 3, "2026-10-03"],
    ]);
  });

  it("일정의 다른 필드(장소 사본 등)는 그대로 둔다", () => {
    const withItems = [{ ...schedule(10, 1, "2026-10-01"), items: [] }, schedule(20, 2, "2026-10-02")];
    expect(moveRoomScheduleToDay(withItems, 10, 2)?.[1]).toMatchObject({ scheduleId: 10, items: [] });
  });

  it("원래 목록을 바꾸지 않는다", () => {
    moveRoomScheduleToDay(schedules, 30, 1);
    expect(schedules.map((s) => s.dayNumber)).toEqual([3, 1, 2]);
  });

  it("일정에 없는 일차면 바꾸지 않는다(undefined)", () => {
    expect(moveRoomScheduleToDay(schedules, 99, 1)).toBeUndefined();
  });
});
