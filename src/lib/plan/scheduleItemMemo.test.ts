import { describe, expect, it } from "vitest";

import { SCHEDULE_ITEM_MEMO_TOO_LONG_MESSAGE, scheduleItemMemoSchema } from "./scheduleItemMemo";

describe("scheduleItemMemoSchema", () => {
  // 칸 아래 글자 수와 같은 기준(입력한 그대로의 길이)으로 본다
  it("trims the memo for save and counts the typed length", () => {
    expect(scheduleItemMemoSchema.parse("  예약 번호 123  ")).toBe("예약 번호 123");
    expect(scheduleItemMemoSchema.safeParse("가".repeat(2000)).success).toBe(true);
    expect(scheduleItemMemoSchema.safeParse(`${"가".repeat(2000)} `).success).toBe(false);
  });

  it("rejects a memo over 2000 characters with one issue on the memo field", () => {
    const result = scheduleItemMemoSchema.safeParse("가".repeat(2001));
    expect(result.error?.issues.map(({ path, message }) => ({ path, message }))).toEqual([
      { path: [], message: SCHEDULE_ITEM_MEMO_TOO_LONG_MESSAGE },
    ]);
  });
});
