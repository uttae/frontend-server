import { describe, expect, it } from "vitest";

import { SCHEDULE_ITEM_MEMO_TOO_LONG_MESSAGE, scheduleItemMemoSchema } from "./scheduleItemMemo";

describe("scheduleItemMemoSchema", () => {
  it("trims the memo for save and counts the trimmed length", () => {
    expect(scheduleItemMemoSchema.parse("  예약 번호 123  ")).toBe("예약 번호 123");
    expect(scheduleItemMemoSchema.safeParse(` ${"가".repeat(2000)} `).success).toBe(true);
  });

  it("rejects a memo over 2000 characters with one issue on the memo field", () => {
    const result = scheduleItemMemoSchema.safeParse("가".repeat(2001));
    expect(result.error?.issues.map(({ path, message }) => ({ path, message }))).toEqual([
      { path: [], message: SCHEDULE_ITEM_MEMO_TOO_LONG_MESSAGE },
    ]);
  });
});
