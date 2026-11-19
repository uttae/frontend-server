import type { RoomSchedule } from "@/lib/api/rooms/schedules";
import { sortRoomSchedules } from "@/lib/plan/scheduleMerge";
import type { PlanPlace } from "@/lib/plan/types";

function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(index, length));
}

export function movePlanPlaceWithinDay(
  places: readonly PlanPlace[],
  itemId: number,
  newOrderIndex: number,
): PlanPlace[] | undefined {
  const from = places.findIndex((p) => p.itemId === itemId);
  const moved = places[from];
  if (from < 0 || !moved) return undefined;
  const next = places.filter((_, i) => i !== from);
  next.splice(clampIndex(newOrderIndex, next.length), 0, moved);
  return next;
}

export function removePlanPlace(
  places: readonly PlanPlace[],
  itemId: number,
): PlanPlace[] | undefined {
  if (!places.some((p) => p.itemId === itemId)) return undefined;
  return places.filter((p) => p.itemId !== itemId);
}

export function insertPlanPlace(
  places: readonly PlanPlace[],
  place: PlanPlace,
  orderIndex: number,
): PlanPlace[] {
  const next = places.filter((p) => p.itemId !== place.itemId);
  next.splice(clampIndex(orderIndex, next.length), 0, place);
  return next;
}

export function moveRoomScheduleToDay<T extends RoomSchedule>(
  schedules: readonly T[],
  scheduleId: number,
  targetDayNumber: number,
): T[] | undefined {
  const sorted = sortRoomSchedules([...schedules]);
  const from = sorted.findIndex((s) => s.scheduleId === scheduleId);
  const moved = sorted[from];
  if (from < 0 || !moved) return undefined;
  const dates = sorted.map((s) => s.date);
  const next = sorted.filter((_, i) => i !== from);
  next.splice(clampIndex(targetDayNumber - 1, next.length), 0, moved);
  return next.map((s, i) => ({ ...s, dayNumber: i + 1, date: dates[i] }));
}
