import { clampCrossDayTargetOrderIndex } from "@/lib/plan/planItemReorder";

/** 장소 카드를 놓은 결과 — PC(HTML5 DnD)·모바일(포인터) 드래그가 같은 모양으로 넘긴다 */
export type PlanItemDrop = {
  itemId: number;
  /** 드래그를 시작한 일차와 그때의 자리 */
  from: { scheduleId: number; index: number };
  /** 놓은 일차와 자리(같은 일차면 옮긴 뒤 자리, 다른 일차면 넣을 자리), 놓을 때 그 일차의 장소 수 */
  to: { scheduleId: number; index: number; length: number };
};

/**
 * 놓은 자리를 보낼 mutation 변수로 바꾼다 — 같은 일차는 순서 변경, 다른 일차는 일차 간 이동.
 * 제자리에 놓았거나 출발 자리가 목록 밖이면 null(보내지 않음).
 * 드래그 중 다른 사람이 순서를 바꿔도 놓은 자리(몇 번째) 그대로 보낸다 — 시작·놓을 때 순서를 비교하지 않는다.
 */
export function resolvePlanItemDrop(roomId: string, { itemId, from, to }: PlanItemDrop) {
  if (from.scheduleId !== to.scheduleId) {
    return {
      kind: "move",
      vars: {
        roomId,
        sourceScheduleId: from.scheduleId,
        itemId,
        targetScheduleId: to.scheduleId,
        targetOrderIndex: clampCrossDayTargetOrderIndex(to.index, to.length),
      },
    } as const;
  }
  // 같은 일차면 놓을 때 목록이 곧 출발 일차다 — 목록 끝 뒤에 놓으면 마지막 자리
  const newOrderIndex = Math.min(to.index, to.length - 1);
  if (from.index < 0 || from.index >= to.length || newOrderIndex < 0 || newOrderIndex === from.index) {
    return null;
  }
  return {
    kind: "reorder",
    vars: { roomId, scheduleId: from.scheduleId, itemId, body: { newOrderIndex } },
  } as const;
}
