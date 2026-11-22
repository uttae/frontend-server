import { describe, expect, it } from "vitest";

import {
  computeDurationMinutesFromRange,
  createScheduleTimeSchema,
  formatScheduleStaySummary,
  formatScheduleTimeRange,
  normalizeStartTimeToHm,
  validateScheduleTimeDraft,
} from "@/lib/plan/scheduleTime";

describe("wall-clock schedule times", () => {
  it.each(["24:00", "23:60", "9:00", "09:00:00", "09:00Z", "2026-09-09T09:00:00Z", " 09:00 "])(
    "rejects noncanonical time %s without conversion",
    (value) => {
      expect(normalizeStartTimeToHm(value)).toBe("");
      expect(validateScheduleTimeDraft(value, "").valid).toBe(false);
      expect(validateScheduleTimeDraft("09:00", value).valid).toBe(false);
    },
  );
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
    expect(formatScheduleStaySummary("23:00", "01:00")).toBe("23:00 – 01:00 (+1일)");
    expect(formatScheduleTimeRange("00:00", "00:00")).toBe("00:00 – 00:00");
    expect(formatScheduleTimeRange("23:00", "00:00")).toBe("23:00 – 00:00 (+1일)");
    expect(formatScheduleTimeRange("00:00", "23:59")).toBe("00:00 – 23:59");
    expect(formatScheduleTimeRange("13:05", null)).toBe("13:05");
  });
});

describe("createScheduleTimeSchema", () => {
  const schema = createScheduleTimeSchema({ serverStartHm: "23:00", serverEndHm: "01:00" });
  const issuesOf = (draft: { start: string | undefined; end: string | undefined }) =>
    schema.safeParse(draft).error?.issues.map(({ path, message }) => ({ path, message })) ?? [];

  it("resolves untouched fields to the server times and pads typed times", () => {
    expect(schema.parse({ start: undefined, end: undefined })).toEqual({ startHm: "23:00", endHm: "01:00" });
    expect(schema.parse({ start: "8:5", end: undefined })).toEqual({ startHm: "08:05", endHm: "01:00" });
    expect(schema.parse({ start: "", end: "" })).toEqual({ startHm: "", endHm: "" });
  });

  it("puts a wrong start on start and a wrong end on end", () => {
    expect(issuesOf({ start: "24:00", end: undefined })).toEqual([
      { path: ["start"], message: "시간을 올바르게 선택해 주세요." },
    ]);
    expect(issuesOf({ start: undefined, end: "01:60" })).toEqual([
      { path: ["end"], message: "시간을 올바르게 선택해 주세요." },
    ]);
  });

  it("puts a wrong end on end even when start is empty", () => {
    expect(issuesOf({ start: "", end: "25:00" })).toEqual([
      { path: ["end"], message: "시간을 올바르게 선택해 주세요." },
    ]);
  });

  it("puts an end without start on start, whose field is the one to fill", () => {
    expect(issuesOf({ start: "", end: undefined })).toEqual([
      { path: ["start"], message: "시작 시각 없이 종료 시각만 설정할 수 없어요." },
    ]);
  });
});
