import type { RoomSchedule } from "@/lib/api/rooms/schedules";
import { sortRoomSchedules } from "@/lib/plan/scheduleMerge";
import type { PlanPlace } from "@/lib/plan/types";

// 저장 응답 전에 캐시에 먼저 그릴 목록을 계산한다. 서버 순서 API와 같은 뜻으로 옮긴다:
// 위치는 옮긴 뒤 목록에서의 자리(0부터)이고, 목록 밖이면 끝으로 붙인다.

function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(index, length));
}

/** 같은 일차 순서 변경 — `itemId` 장소를 `newOrderIndex` 자리로 옮긴 새 목록. 목록에 없으면 `undefined` */
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

/** 일차 간 이동의 출발 일차 — `itemId` 장소를 뺀 새 목록. 목록에 없으면 `undefined` */
export function removePlanPlace(
  places: readonly PlanPlace[],
  itemId: number,
): PlanPlace[] | undefined {
  if (!places.some((p) => p.itemId === itemId)) return undefined;
  return places.filter((p) => p.itemId !== itemId);
}

/** 일차 간 이동의 대상 일차 — `place`를 `orderIndex` 자리에 넣은 새 목록. 이미 있으면 그 자리로 옮긴다(두 번 넣지 않음) */
export function insertPlanPlace(
  places: readonly PlanPlace[],
  place: PlanPlace,
  orderIndex: number,
): PlanPlace[] {
  const next = places.filter((p) => p.itemId !== place.itemId);
  next.splice(clampIndex(orderIndex, next.length), 0, place);
  return next;
}

/**
 * 일차 순서 변경 — `scheduleId` 일차를 `targetDayNumber`(1부터) 자리로 옮기고 위치대로 다시 매긴다.
 * 날짜 라벨은 `date`, 정렬은 `dayNumber`로 하므로 둘 다 바꾼다. 날짜는 원래 자리의 날짜를 그대로 남긴다
 * (여행 날짜는 그대로고 일차만 바뀐다). 일정에 없으면 `undefined`
 */
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
