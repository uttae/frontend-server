import { create } from "zustand";

type State = {
  visibleByScheduleId: Record<number, boolean>;
  visibilityOrder: number[];
  setRouteVisible: (scheduleId: number, visible: boolean) => void;
  syncRouteVisibility: (activeScheduleIds: readonly number[]) => void;
};

function appendOrder(order: number[], scheduleId: number): number[] {
  return [...order.filter((id) => id !== scheduleId), scheduleId];
}

function removeOrder(order: number[], scheduleId: number): number[] {
  return order.filter((id) => id !== scheduleId);
}

export const usePlanScheduleRouteVisibilityStore = create<State>((set) => ({
  visibleByScheduleId: {},
  visibilityOrder: [],
  setRouteVisible: (scheduleId, visible) => {
    if (!Number.isFinite(scheduleId)) return;
    set((s) => ({
      visibleByScheduleId: {
        ...s.visibleByScheduleId,
        [scheduleId]: visible,
      },
      visibilityOrder: visible
        ? appendOrder(s.visibilityOrder, scheduleId)
        : removeOrder(s.visibilityOrder, scheduleId),
    }));
  },
  syncRouteVisibility: (activeScheduleIds) => {
    set((s) => {
      const activeSet = new Set(activeScheduleIds.filter((id) => Number.isFinite(id)));
      const next: Record<number, boolean> = {};
      let order = s.visibilityOrder.filter((id) => activeSet.has(id));

      for (const id of activeScheduleIds) {
        if (!Number.isFinite(id)) continue;
        const hadKey = id in s.visibleByScheduleId;
        const visible = s.visibleByScheduleId[id] ?? true;
        next[id] = visible;
        if (!hadKey && visible) order = appendOrder(order, id);
      }

      return { visibleByScheduleId: next, visibilityOrder: order };
    });
  },
}));
