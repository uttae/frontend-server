import { describe, expect, it } from "vitest";

import {
  computeDurationMinutesFromRange,
  formatScheduleStaySummary,
  formatScheduleTimeRange,
  normalizeStartTimeToHm,
  validateScheduleTimeDraft,
} from "@/lib/plan/scheduleTime";

describe("wall-clock schedule times", () => {
  it.each([
    "24:00",
    "23:60",
    "9:00",
    "09:00:00",
    "09:00Z",
    "2026-09-09T09:00:00Z",
    " 09:00 ",
  ])("rejects noncanonical time %s without conversion", (value) => {
    expect(normalizeStartTimeToHm(value)).toBe("");
    expect(validateScheduleTimeDraft(value, "").valid).toBe(false);
    expect(validateScheduleTimeDraft("09:00", value).valid).toBe(false);
  });
  it.each([
    ["", ""],
    ["00:00", ""],
    ["23:00", "01:00"],
    ["00:00", "23:59"],
    ["00:00", "00:00"],
  ])("accepts %s → %s", (start, end) => {
    expect(validateScheduleTimeDraft(start, end)).toEqual({ valid: true });
  });
  it("requires start even when end is midnight", () => {
    expect(validateScheduleTimeDraft("", "00:00")).toEqual({
      valid: false,
      message: "시작 시각 없이 종료 시각만 설정할 수 없어요.",
    });
  });
  it.each([
    ["23:00", "00:00", 60],
    ["23:00", "01:00", 120],
    ["00:00", "23:59", 1439],
    ["00:00", "00:00", 0],
  ])("calculates %s → %s as %i minutes", (start, end, minutes) => {
    expect(computeDurationMinutesFromRange(start, end)).toBe(minutes);
  });
  it("displays card times in 24-hour format and marks next-day ends", () => {
    expect(formatScheduleStaySummary("", null)).toBe("");
    expect(formatScheduleStaySummary("09:00", null)).toBe("09:00");
    expect(formatScheduleStaySummary("23:00", "01:00")).toBe(
      "23:00 – 01:00 (+1일)",
    );
    expect(formatScheduleTimeRange("00:00", "00:00")).toBe(
      "00:00 – 00:00",
    );
    expect(formatScheduleTimeRange("23:00", "00:00")).toBe(
      "23:00 – 00:00 (+1일)",
    );
    expect(formatScheduleTimeRange("00:00", "23:59")).toBe(
      "00:00 – 23:59",
    );
    expect(formatScheduleTimeRange("13:05", null)).toBe("13:05");
  });
});
