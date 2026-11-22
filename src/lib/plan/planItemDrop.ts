import { clampCrossDayTargetOrderIndex } from "@/lib/plan/planItemReorder";

export type PlanItemDrop = {
  itemId: number;
  from: { scheduleId: number; index: number };
  to: { scheduleId: number; index: number; length: number };
};

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
  const newOrderIndex = Math.min(to.index, to.length - 1);
  if (from.index < 0 || from.index >= to.length || newOrderIndex < 0 || newOrderIndex === from.index) {
    return null;
  }
  return {
    kind: "reorder",
    vars: { roomId, scheduleId: from.scheduleId, itemId, body: { newOrderIndex } },
  } as const;
}
