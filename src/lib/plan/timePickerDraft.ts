import { normalizeStartTimeToHm } from "./scheduleTime";

export type TimePeriod = "AM" | "PM";
export type TimeParts = {
  period: TimePeriod | null;
  hour: number | null;
  minute: number | null;
};

/** 빈 시작 시간의 휠을 열면 들어가는 값(오전 10:00). 휠의 미리보기(오전·10·00)와 같다 */
export const TIME_PICKER_DEFAULT_START_HM = "10:00";

export function timePartsFromHm(value: string): TimeParts {
  if (!normalizeStartTimeToHm(value)) return { period: null, hour: null, minute: null };
  const [hour, minute] = value.split(":").map(Number);
  return { period: hour < 12 ? "AM" : "PM", hour: hour % 12, minute };
}

/** Empty, incomplete, and complete input have different save semantics. */
export function timePartsToHm(parts: TimeParts): string | null {
  if (parts.period === null && parts.hour === null && parts.minute === null) return "";
  if (parts.period === null || parts.hour === null || parts.minute === null) return null;
  const hour = parts.hour + (parts.period === "PM" ? 12 : 0);
  return `${String(hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export function formatTimePickerValue(value: string | null): string {
  if (value === null) return "선택 중";
  if (!value) return "";
  const [hour, minute] = value.split(":").map(Number);
  return `${hour < 12 ? "오전" : "오후"} ${hour % 12 || 12}:${String(minute).padStart(2, "0")}`;
}
