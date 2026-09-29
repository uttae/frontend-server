import { describe, expect, it, vi } from "vitest";

import type { PlanPlace } from "@/lib/plan/types";

vi.mock("@/hooks/useRooms", () => ({
  useMoveScheduleItemToSchedule: vi.fn(),
  useReorderScheduleItem: vi.fn(),
}));
vi.mock("@/lib/analytics/track", () => ({ AnalyticsEvents: {}, trackAnalyticsEvent: vi.fn() }));

const { applyPendingPlanMove } = await import("./mobilePlanDrag");

function place(itemId: number): PlanPlace {
  return { id: `item-${itemId}`, itemId, title: `장소 ${itemId}` };
}
const ids = (places: PlanPlace[]) => places.map((p) => p.itemId);

describe("applyPendingPlanMove", () => {
  const day1 = [place(1), place(2), place(3)];
  const day2 = [place(10)];

  it("처리 중인 이동이 없으면 서버 목록 그대로", () => {
    expect(applyPendingPlanMove(1, day1, null)).toBe(day1);
  });

  it("같은 일차 순서 변경은 그 일차에만 새 순서를 적용한다", () => {
    const pending = { kind: "reorder" as const, scheduleId: 1, order: ["item-3", "item-1", "item-2"] };
    expect(ids(applyPendingPlanMove(1, day1, pending))).toEqual([3, 1, 2]);
    expect(applyPendingPlanMove(2, day2, pending)).toBe(day2);
  });

  it("다른 일차로 이동하면 원래 일차에서 빼고 대상 일차의 위치에 넣는다", () => {
    const pending = {
      kind: "move" as const,
      place: day1[1]!,
      fromScheduleId: 1,
      toScheduleId: 2,
      toIndex: 0,
    };
    expect(ids(applyPendingPlanMove(1, day1, pending))).toEqual([1, 3]);
    expect(ids(applyPendingPlanMove(2, day2, pending))).toEqual([2, 10]);
  });

  it("서버 목록에 이미 반영됐으면 대상 일차에 중복으로 넣지 않는다", () => {
    const pending = {
      kind: "move" as const,
      place: place(2),
      fromScheduleId: 1,
      toScheduleId: 2,
      toIndex: 0,
    };
    expect(ids(applyPendingPlanMove(2, [place(2), place(10)], pending))).toEqual([2, 10]);
  });
});
