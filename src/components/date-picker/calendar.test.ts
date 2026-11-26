import { describe, expect, it } from "vitest";

import { confirmPickedRange, displayPickedRange, pickRangeDate, type DateRange } from "./calendar";

const value: DateRange = { start: "2026-10-15", end: "2026-10-22" };

describe("pickRangeDate", () => {
  it("changes only the start when the start is picked and keeps the current end", () => {
    const { picked, edge } = pickRangeDate(value, {}, "start", "2026-10-17");
    expect(picked).toEqual({ start: "2026-10-17" });
    expect(edge).toBe("end");
    expect(displayPickedRange(value, picked)).toEqual({ start: "2026-10-17", end: "2026-10-22" });
    expect(confirmPickedRange(value, picked)).toEqual({ start: "2026-10-17", end: "2026-10-22" });
  });

  it("changes only the end when the end is picked", () => {
    const { picked, edge } = pickRangeDate(value, {}, "end", "2026-10-24");
    expect(picked).toEqual({ end: "2026-10-24" });
    expect(edge).toBe("start");
    expect(confirmPickedRange(value, picked)).toEqual({ start: "2026-10-15", end: "2026-10-24" });
  });

  it("makes an end earlier than the start the new start and keeps the current end", () => {
    const { picked, edge } = pickRangeDate(value, {}, "end", "2026-10-12");
    expect(picked).toEqual({ start: "2026-10-12" });
    expect(edge).toBe("end");
    expect(confirmPickedRange(value, picked)).toEqual({ start: "2026-10-12", end: "2026-10-22" });
  });

  it("hides an end that falls before a new start until it is picked again, without changing it on confirm", () => {
    const { picked } = pickRangeDate(value, {}, "start", "2026-10-25");
    expect(displayPickedRange(value, picked)).toEqual({ start: "2026-10-25", end: "" });
    expect(confirmPickedRange(value, picked)).toEqual({ start: "2026-10-25", end: "2026-10-22" });
  });
});

describe("confirmPickedRange", () => {
  it("changes nothing when no date was picked", () => {
    expect(confirmPickedRange(value, {})).toBeNull();
  });
});
