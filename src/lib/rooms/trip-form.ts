export const ROOM_TRIP_TITLE_MAX_LENGTH = 20;
export const TRIP_DESTINATIONS_MAX_COUNT = 5;
export const TRIP_DESTINATION_MAX_LENGTH = 100;

export const TRIP_DATE_INPUT_CLASS =
  "relative w-full cursor-pointer border-0 bg-transparent p-0 pl-7 text-[17px] outline-none [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:left-0 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:w-4 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-datetime-edit]:text-inherit";

export const TRIP_FORM_FIELD_CLASS =
  "rounded-2xl border-2 border-gray-border bg-white px-5 py-4 transition focus-within:border-primary";

export const TRIP_FORM_FIELD_READ_ONLY_CLASS =
  "rounded-2xl border-2 border-gray-border bg-bubble-gray/30 px-5 py-4";

export const TRIP_DATE_RANGE_INVALID_MESSAGE =
  "종료일은 시작일 이후여야 해요." as const;

export const TRIP_START_BEFORE_MIN_MESSAGE =
  "시작일은 최초 여행 시작일 이전으로 바꿀 수 없어요." as const;

/** 종료일 date input `min` — floor 이전·시작일 이전 선택 방지 */
export function tripEndDateMinYmd(startDate: string, floorYmd: string): string {
  const floor = floorYmd.trim();
  if (!floor) return startDate.trim();
  if (startDate.trim() && startDate > floor) return startDate;
  return floor;
}

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

export type TripFormValues = {
  title: string;
  destinations: string[];
  startDate: string;
  endDate: string;
};

export function toTripFormValues(source: RoomTripFormSource): TripFormValues {
  return {
    title: source.title,
    destinations: [...source.destinations],
    startDate: source.startDate ?? "",
    endDate: source.endDate ?? "",
  };
}

/** 서버 계약: 1~5개, 각 항목 trim 후 1~100자, 중복 불가 */
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

/** 순서·값이 모두 같아야 true (dirty 판정용) */
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
