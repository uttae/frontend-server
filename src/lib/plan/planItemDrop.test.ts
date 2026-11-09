import { describe, expect, it } from "vitest";

import { resolvePlanItemDrop, type PlanItemDrop } from "@/lib/plan/planItemDrop";

const sameDay = (fromIndex: number, toIndex: number, length = 4): PlanItemDrop => ({
  itemId: 7,
  from: { scheduleId: 1, index: fromIndex },
  to: { scheduleId: 1, index: toIndex, length },
});

describe("resolvePlanItemDrop", () => {
  it("같은 일차는 옮긴 뒤 자리로 순서 변경 변수를 만든다", () => {
    expect(resolvePlanItemDrop("room", sameDay(0, 2))).toEqual({
      kind: "reorder",
      vars: { roomId: "room", scheduleId: 1, itemId: 7, body: { newOrderIndex: 2 } },
    });
  });

  it("같은 일차 목록 끝 뒤에 놓으면 마지막 자리", () => {
    expect(resolvePlanItemDrop("room", sameDay(0, 4))?.vars).toMatchObject({ body: { newOrderIndex: 3 } });
  });

  it("제자리에 놓았거나 출발 자리가 목록 밖이면 보내지 않는다", () => {
    expect(resolvePlanItemDrop("room", sameDay(2, 2))).toBeNull();
    expect(resolvePlanItemDrop("room", sameDay(3, 9))).toBeNull();
    expect(resolvePlanItemDrop("room", sameDay(5, 1))).toBeNull();
  });

  it("드래그 중 목록이 바뀌어도 놓은 자리(몇 번째) 그대로 보낸다", () => {
    // 시작 때 2곳이었는데 놓을 때 앞에 하나가 더 들어왔다 — 시작 자리와 놓은 자리를 그대로 쓴다
    expect(resolvePlanItemDrop("room", sameDay(0, 1, 3))?.vars).toMatchObject({ body: { newOrderIndex: 1 } });
  });

  it("다른 일차는 대상 일차 길이 안으로 넣을 자리를 맞춰 일차 간 이동 변수를 만든다", () => {
    const drop: PlanItemDrop = { itemId: 7, from: { scheduleId: 1, index: 1 }, to: { scheduleId: 2, index: 5, length: 2 } };
    expect(resolvePlanItemDrop("room", drop)).toEqual({
      kind: "move",
      vars: { roomId: "room", sourceScheduleId: 1, itemId: 7, targetScheduleId: 2, targetOrderIndex: 2 },
    });
    expect(resolvePlanItemDrop("room", { ...drop, to: { scheduleId: 2, index: 0, length: 0 } })?.vars).toMatchObject({
      targetOrderIndex: 0,
    });
  });
});
