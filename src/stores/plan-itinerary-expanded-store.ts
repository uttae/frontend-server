import { create } from "zustand";

type ExpandedState = {
  expandedByScheduleId: Record<number, boolean>;
  expansionOrder: number[];
  roomResetRevision: number;
  setScheduleExpanded: (scheduleId: number, expanded: boolean) => void;
  syncScheduleExpansionState: (activeScheduleIds: readonly number[]) => void;
};

function appendExpansionOrder(order: number[], scheduleId: number): number[] {
  const without = order.filter((id) => id !== scheduleId);
  return [...without, scheduleId];
}

function removeExpansionOrder(order: number[], scheduleId: number): number[] {
  return order.filter((id) => id !== scheduleId);
}

export const usePlanItineraryExpandedStore = create<ExpandedState>((set) => ({
  expandedByScheduleId: {},
  expansionOrder: [],
  roomResetRevision: 0,
  setScheduleExpanded: (scheduleId, expanded) => {
    if (!Number.isFinite(scheduleId)) return;
    set((s) => {
      const expansionOrder = expanded
        ? appendExpansionOrder(s.expansionOrder, scheduleId)
        : removeExpansionOrder(s.expansionOrder, scheduleId);
      return {
        expandedByScheduleId: {
          ...s.expandedByScheduleId,
          [scheduleId]: expanded,
        },
        expansionOrder,
      };
    });
  },
  syncScheduleExpansionState: (activeScheduleIds) => {
    set((s) => {
      const activeSet = new Set(activeScheduleIds.filter((id) => Number.isFinite(id)));
      const next: Record<number, boolean> = {};
      let expansionOrder = s.expansionOrder.filter((id) => activeSet.has(id));

      for (const id of activeScheduleIds) {
        if (!Number.isFinite(id)) continue;
        const hadKey = id in s.expandedByScheduleId;
        const expanded = s.expandedByScheduleId[id] ?? true;
        next[id] = expanded;
        if (!hadKey && expanded) {
          expansionOrder = appendExpansionOrder(expansionOrder, id);
        }
      }

      return { expandedByScheduleId: next, expansionOrder };
    });
  },
}));
