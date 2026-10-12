import type { RoomSchedule } from "@/lib/api/rooms/schedules";
import type { PlanDayData } from "@/lib/plan/types";

import {
  formatKoreanDateLabel,
  formatShortDateLabel,
  parseLocalYmd,
} from "@/lib/plan/tripRange";

export function sortRoomSchedules<T extends { dayNumber: number }>(
  schedules: T[],
): T[] {
  return [...schedules].sort((a, b) => a.dayNumber - b.dayNumber);
}

/** 0-based 일차 index 뒤에 삽입할 때 `POST /schedules` body의 `dayNumber` (1-based) */
export function dayNumberForInsertAfterDayIndex(dayIndex: number): number {
  return dayIndex + 2;
}

export function mergeSchedulesWithPlaces(schedules: RoomSchedule[]): PlanDayData[] {
  const sorted = sortRoomSchedules(schedules);
  return sorted.map((s, i) => ({
    id: `schedule-${s.scheduleId}`,
    dayLabel: `${i + 1}일차`,
    dateLabel: formatKoreanDateLabel(parseLocalYmd(s.date)),
    shortDateLabel: formatShortDateLabel(parseLocalYmd(s.date)),
    places: [],
  }));
}
