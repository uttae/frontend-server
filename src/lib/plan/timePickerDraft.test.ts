import { describe, expect, it } from "vitest";

import { defaultEndHm } from "./timePickerDraft";

describe("defaultEndHm", () => {
  it.each([
    ["10:00", "11:00"],
    ["14:30", "15:30"],
    ["23:30", "00:30"],
    ["23:00", "00:00"],
  ])("starts the end one hour after %s at %s", (start, end) => {
    expect(defaultEndHm(start)).toBe(end);
  });

  it("returns empty for an invalid start", () => {
    expect(defaultEndHm("")).toBe("");
  });
});
