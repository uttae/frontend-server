import { z } from "zod";

const MINUTES_PER_DAY = 24 * 60;

export type ScheduleTimeDraftValidation = { valid: true } | { valid: false; message: string };

export function normalizeStartTimeToHm(value: string): string {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : "";
}

export function validateScheduleTimeDraft(startTime: string, endTime: string): ScheduleTimeDraftValidation {
  if ((startTime && !normalizeStartTimeToHm(startTime)) || (endTime && !normalizeStartTimeToHm(endTime))) {
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

export type ScheduleTimeDraft = { start: string | undefined; end: string | undefined };
type ScheduleServerTimes = { serverStartHm: string; serverEndHm: string };

function canonicalHm(value: string): string {
  if (!/^\d{1,2}:\d{1,2}$/.test(value)) return value;
  return value
    .split(":")
    .map((part) => part.padStart(2, "0"))
    .join(":");
}

export function resolveScheduleTimeDraft(
  draft: ScheduleTimeDraft,
  { serverStartHm, serverEndHm }: ScheduleServerTimes,
) {
  return {
    startHm: canonicalHm(draft.start ?? serverStartHm),
    endHm: canonicalHm(draft.end ?? serverEndHm),
  };
}

function scheduleTimeIssueField({ startHm, endHm }: { startHm: string; endHm: string }): "start" | "end" {
  if (startHm && !normalizeStartTimeToHm(startHm)) return "start";
  if (endHm && !normalizeStartTimeToHm(endHm)) return "end";
  return "start";
}

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

export function formatScheduleStaySummary(startTime: string, endTime: string | null | undefined): string {
  const start = normalizeStartTimeToHm(startTime);
  const end = normalizeStartTimeToHm(endTime ?? "");
  if (!start) return "";
  if (!end) return start;
  return `${start} – ${end}${end < start ? " (+1일)" : ""}`;
}

export function formatScheduleTimeRange(startTime: string, endTime: string | null | undefined): string {
  return formatScheduleStaySummary(startTime, endTime);
}

export function computeDurationMinutesFromRange(startHm: string, endHm: string): number | null {
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
