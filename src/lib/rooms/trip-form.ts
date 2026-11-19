import { z } from "zod";

import {
  isTripScheduleDayLimitExceeded,
  TRIP_SCHEDULE_DAY_LIMIT_MESSAGE,
} from "@/lib/plan/schedulePolicy";

export const ROOM_TRIP_TITLE_MAX_LENGTH = 20;
export const TRIP_DESTINATIONS_MAX_COUNT = 5;
export const TRIP_DESTINATION_MAX_LENGTH = 100;

export const TRIP_DATE_RANGE_INVALID_MESSAGE =
  "종료일은 시작일 이후여야 해요." as const;

export const TRIP_TITLE_REQUIRED_MESSAGE = "여행 제목을 입력해 주세요." as const;
export const TRIP_DESTINATIONS_REQUIRED_MESSAGE = "여행지를 하나 이상 선택해 주세요." as const;
export const TRIP_DESTINATIONS_INVALID_MESSAGE = "여행지는 서로 다른 곳으로 5개까지 선택해 주세요." as const;
export const TRIP_DATES_REQUIRED_MESSAGE = "여행 기간을 선택해 주세요." as const;

export const TRIP_START_BEFORE_MIN_MESSAGE =
  "시작일은 최초 여행 시작일 이전으로 바꿀 수 없어요." as const;

export function isTripStartBeforeMin(
  startDate: string,
  minYmd: string,
): boolean {
  const min = minYmd.trim();
  return Boolean(min && startDate.trim() && startDate < min);
}

export type RoomTripFormSource = {
  id: string;
  title: string;
  destinations: string[];
  startDate: string | null;
  endDate: string | null;
};

export function toTripFormValues(source: RoomTripFormSource): TripFormValues {
  return {
    title: source.title,
    destinations: [...source.destinations],
    startDate: source.startDate ?? "",
    endDate: source.endDate ?? "",
  };
}

export function isTripDestinationsValid(destinations: string[]): boolean {
  if (destinations.length < 1) return false;
  if (destinations.length > TRIP_DESTINATIONS_MAX_COUNT) return false;
  const seen = new Set<string>();
  for (const raw of destinations) {
    const trimmed = raw.trim();
    if (!trimmed) return false;
    if (trimmed.length > TRIP_DESTINATION_MAX_LENGTH) return false;
    if (seen.has(trimmed)) return false;
    seen.add(trimmed);
  }
  return true;
}

export function areDestinationsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function isTripDateRangeInvalid(startDate: string, endDate: string) {
  return Boolean(startDate && endDate && endDate < startDate);
}

function tripDatesMessage(startDate: string, endDate: string, startDateMin?: string): string | undefined {
  if (!startDate || !endDate) return TRIP_DATES_REQUIRED_MESSAGE;
  if (startDateMin != null && isTripStartBeforeMin(startDate, startDateMin)) return TRIP_START_BEFORE_MIN_MESSAGE;
  if (isTripDateRangeInvalid(startDate, endDate)) return TRIP_DATE_RANGE_INVALID_MESSAGE;
  if (isTripScheduleDayLimitExceeded(startDate, endDate)) return TRIP_SCHEDULE_DAY_LIMIT_MESSAGE;
  return undefined;
}

export const tripTitleSchema = z.string().trim().min(1, TRIP_TITLE_REQUIRED_MESSAGE);

export const tripDestinationsSchema = z.array(z.string().trim()).superRefine((destinations, ctx) => {
  if (destinations.length === 0) {
    ctx.addIssue({ code: "custom", message: TRIP_DESTINATIONS_REQUIRED_MESSAGE });
  } else if (!isTripDestinationsValid(destinations)) {
    ctx.addIssue({ code: "custom", message: TRIP_DESTINATIONS_INVALID_MESSAGE });
  }
});

type TripSchemaOptions = { startDateMin?: string };

export function createTripDatesSchema({ startDateMin }: TripSchemaOptions = {}) {
  return z.object({ startDate: z.string(), endDate: z.string() }).superRefine(({ startDate, endDate }, ctx) => {
    const message = tripDatesMessage(startDate, endDate, startDateMin);
    if (message) ctx.addIssue({ code: "custom", path: ["endDate"], message });
  });
}

export function createTripFormSchema({ startDateMin }: TripSchemaOptions = {}) {
  return z
    .object({
      title: tripTitleSchema,
      destinations: tripDestinationsSchema,
      startDate: z.string(),
      endDate: z.string(),
    })
    .superRefine(({ startDate, endDate }, ctx) => {
      const message = tripDatesMessage(startDate, endDate, startDateMin);
      if (message) ctx.addIssue({ code: "custom", path: ["endDate"], message });
    });
}

export type TripFormValues = z.input<ReturnType<typeof createTripFormSchema>>;
