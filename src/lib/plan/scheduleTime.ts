const MINUTES_PER_DAY = 24 * 60;

export type ScheduleTimeDraftValidation =
  { valid: true } | { valid: false; message: string };

/** 날짜·시간대 변환 없이 정규 HH:mm만 허용합니다. */
export function normalizeStartTimeToHm(value: string): string {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : "";
}

export function validateScheduleTimeDraft(
  startTime: string,
  endTime: string,
): ScheduleTimeDraftValidation {
  if (
    (startTime && !normalizeStartTimeToHm(startTime)) ||
    (endTime && !normalizeStartTimeToHm(endTime))
  ) {
    return { valid: false, message: "시간을 올바르게 선택해 주세요." };
  }
  if (!startTime && endTime) {
    return {
      valid: false,
      message: "시작 시각 없이 종료 시각만 설정할 수 없어요.",
    };
  }
  return { valid: true };
}

/** 미정 종료와 같은 시각(0분)을 구별하고 익일 종료를 표시합니다. */
export function formatScheduleStaySummary(
  startTime: string,
  endTime: string | null | undefined,
): string {
  const start = normalizeStartTimeToHm(startTime);
  const end = normalizeStartTimeToHm(endTime ?? "");
  if (!start) return "";
  if (!end) return start;
  return `${start} – ${end}${end < start ? " (+1일)" : ""}`;
}

function hmToTwelveHourWithPeriod(hm: string): string {
  const [hour, minute] = hm.split(":");
  const h = Number(hour);
  return `${h % 12 || 12}:${minute} ${h >= 12 ? "PM" : "AM"}`;
}

export function formatScheduleTimeRange(
  startTime: string,
  endTime: string | null | undefined,
): string {
  const start = normalizeStartTimeToHm(startTime);
  const end = normalizeStartTimeToHm(endTime ?? "");
  if (!start) return "";
  const startLabel = hmToTwelveHourWithPeriod(start);
  if (!end) return startLabel;
  return `${startLabel} – ${hmToTwelveHourWithPeriod(end)}${end < start ? " (+1일)" : ""}`;
}

/**
 * 시작·종료 `HH:mm`을 자정 기준 분 차이로 환산. 종료가 시작보다 작으면 자정을 넘긴 것으로 간주.
 * 시작/종료 중 하나라도 파싱 불가면 `null`.
 */
export function computeDurationMinutesFromRange(
  startHm: string,
  endHm: string,
): number | null {
  const s = hmToMinutesSinceMidnight(startHm);
  const e = hmToMinutesSinceMidnight(endHm);
  if (s === null || e === null) return null;
  const raw = e - s;
  return raw < 0 ? raw + MINUTES_PER_DAY : raw;
}

export function hmToMinutesSinceMidnight(hm: string): number | null {
  const n = normalizeStartTimeToHm(hm);
  if (!n) return null;
  const [hStr, mStr] = n.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

/** 0..1439 분을 같은 날 기준 `HH:mm`으로. */
export function minutesSinceMidnightToHm(totalMinutes: number): string {
  const wrapped =
    ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** `HH:mm`(또는 `normalizeStartTimeToHm` 가능한 문자열)에 분을 더한 같은 날 래핑 결과. 입력이 빈 문자열이면 분만 적용합니다. */
export function addMinutesToHm(hm: string, minutesToAdd: number): string {
  if (!Number.isFinite(minutesToAdd)) minutesToAdd = 0;
  const base = hmToMinutesSinceMidnight(hm);
  if (base === null) {
    return minutesSinceMidnightToHm(minutesToAdd);
  }
  return minutesSinceMidnightToHm(base + minutesToAdd);
}
