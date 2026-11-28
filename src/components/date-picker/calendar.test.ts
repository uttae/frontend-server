import { describe, expect, it } from "vitest";

import { formatRangeLabel, formatSelectionSummary, pickRangeDate, type DateRange } from "./calendar";

const range: DateRange = { start: "2026-10-15", end: "2026-10-22" };

describe("pickRangeDate", () => {
  it("changes the start and keeps an end that is not before it", () => {
    expect(pickRangeDate({ range, edge: "start" }, "2026-10-17")).toEqual({
      range: { start: "2026-10-17", end: "2026-10-22" },
      edge: "end",
    });
  });

  it("clears the end when the new start is after it, so what is shown is what is saved", () => {
    expect(pickRangeDate({ range, edge: "start" }, "2026-10-25")).toEqual({
      range: { start: "2026-10-25", end: "" },
      edge: "end",
    });
  });

  it("changes the end on the end edge and goes back to the start edge", () => {
    expect(pickRangeDate({ range, edge: "end" }, "2026-10-24")).toEqual({
      range: { start: "2026-10-15", end: "2026-10-24" },
      edge: "start",
    });
  });

  it("makes a day before the start the new start even on the end edge", () => {
    expect(pickRangeDate({ range, edge: "end" }, "2026-10-12")).toEqual({
      range: { start: "2026-10-12", end: "2026-10-22" },
      edge: "end",
    });
  });

  it("starts from an empty range after a reset", () => {
    const first = pickRangeDate({ range: { start: "", end: "" }, edge: "start" }, "2026-11-22");
    expect(first).toEqual({ range: { start: "2026-11-22", end: "" }, edge: "end" });
    expect(pickRangeDate(first, "2026-11-27")).toEqual({
      range: { start: "2026-11-22", end: "2026-11-27" },
      edge: "start",
    });
  });
});

describe("formatRangeLabel", () => {
  it("shows the range without nights, only the start, or a prompt", () => {
    expect(formatRangeLabel({ start: "2026-11-22", end: "2026-11-27" })).toBe("11.22 일 - 11.27 금");
    expect(formatRangeLabel({ start: "2026-11-22", end: "" })).toBe("11.22 일");
    expect(formatRangeLabel({ start: "", end: "" })).toBe("날짜를 선택해 주세요");
  });
});

describe("formatSelectionSummary", () => {
  it("adds the nights to a complete range", () => {
    expect(formatSelectionSummary({ start: "2026-11-22", end: "2026-11-27" })).toBe("11.22 일 - 11.27 금 (5박)");
    expect(formatSelectionSummary({ start: "2026-11-22", end: "" })).toBe("11.22 일");
  });
});
