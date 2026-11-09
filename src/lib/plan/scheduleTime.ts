import { z } from "zod";

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

/** 칸 값이 undefined면 사용자가 아직 고치지 않은 칸이라 서버 값을 따른다. ""는 비운 칸(초기화)이다 */
export type ScheduleTimeDraft = { start: string | undefined; end: string | undefined };
type ScheduleServerTimes = { serverStartHm: string; serverEndHm: string };

// "9:5"처럼 한 자리로 친 시·분을 "09:05"로 맞춘다. 모양이 다르면 그대로 둬서 검증이 잡게 한다
function canonicalHm(value: string): string {
  if (!/^\d{1,2}:\d{1,2}$/.test(value)) return value;
  return value.split(":").map((part) => part.padStart(2, "0")).join(":");
}

/** 폼 값과 서버 값을 합친 시각. 고치지 않은 칸은 서버 값을 쓴다 */
export function resolveScheduleTimeDraft(draft: ScheduleTimeDraft, { serverStartHm, serverEndHm }: ScheduleServerTimes) {
  return {
    startHm: canonicalHm(draft.start ?? serverStartHm),
    endHm: canonicalHm(draft.end ?? serverEndHm),
  };
}

// 오류를 붙일 칸. 형식이 틀린 칸이 있으면 그 칸, 없으면(종료만 있음) 채워야 할 시작 칸이다 — 종료 칸은 시작이 없으면 비활성이다
function scheduleTimeIssueField({ startHm, endHm }: { startHm: string; endHm: string }): "start" | "end" {
  if (startHm && !normalizeStartTimeToHm(startHm)) return "start";
  if (endHm && !normalizeStartTimeToHm(endHm)) return "end";
  return "start";
}

/** 일정 시간 폼 스키마. 서버 값을 받아 폼 값과 합친 시각을 검증하고, 통과하면 합친 시각({ startHm, endHm })을 돌려준다 */
export function createScheduleTimeSchema(server: ScheduleServerTimes) {
  return z
    .object({ start: z.string().or(z.undefined()), end: z.string().or(z.undefined()) })
    .transform((draft, ctx) => {
      const times = resolveScheduleTimeDraft(draft, server);
      const result = validateScheduleTimeDraft(times.startHm, times.endHm);
      if (result.valid) return times;
      ctx.addIssue({ code: "custom", path: [scheduleTimeIssueField(times)], message: result.message });
      return z.NEVER;
    });
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

export function formatScheduleTimeRange(
  startTime: string,
  endTime: string | null | undefined,
): string {
  return formatScheduleStaySummary(startTime, endTime);
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
