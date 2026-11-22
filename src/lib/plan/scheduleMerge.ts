import type { RoomSchedule } from "@/lib/api/rooms/schedules";
import type { PlanDayData } from "@/lib/plan/types";

import { formatMobileDayDate } from "@/lib/plan/mobilePlanFormat";
import { formatKoreanDateLabel, parseLocalYmd } from "@/lib/plan/tripRange";

export function sortRoomSchedules<T extends { dayNumber: number }>(schedules: T[]): T[] {
  return [...schedules].sort((a, b) => a.dayNumber - b.dayNumber);
}

export function dayNumberForInsertAfterDayIndex(dayIndex: number): number {
  return dayIndex + 2;
}

export function mergeSchedulesWithPlaces(schedules: RoomSchedule[]): PlanDayData[] {
  const sorted = sortRoomSchedules(schedules);
  return sorted.map((s, i) => ({
    id: `schedule-${s.scheduleId}`,
    dayLabel: `${i + 1}일차`,
    dateLabel: formatKoreanDateLabel(parseLocalYmd(s.date)),
    shortDateLabel: formatMobileDayDate(s.date),
    places: [],
  }));
}
