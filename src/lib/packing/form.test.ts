import { describe, expect, it } from "vitest";

import { packingMemoSchema, packingNameSchema } from "./form";

const issuesOf = (result: { error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  result.error?.issues.map(({ path, message }) => ({ path, message })) ?? [];

describe("packing form schemas", () => {
  it("uses the normalize rules and messages for names", () => {
    expect(packingNameSchema.part.safeParse(" 옷 ").success).toBe(true);
    expect(issuesOf(packingNameSchema.part.safeParse("  "))).toEqual([{ path: [], message: "이름을 입력해 주세요." }]);
    expect(issuesOf(packingNameSchema.part.safeParse("가".repeat(51)))).toEqual([
      { path: [], message: "이름은 줄바꿈 없이 1~50자로 입력해 주세요." },
    ]);
    expect(packingNameSchema.item.safeParse("가".repeat(100)).success).toBe(true);
    expect(issuesOf(packingNameSchema.item.safeParse("a\nb"))).toEqual([
      { path: [], message: "이름은 줄바꿈 없이 1~100자로 입력해 주세요." },
    ]);
  });

  it("uses the normalize rule and message for memos", () => {
    expect(packingMemoSchema.safeParse("").success).toBe(true);
    expect(packingMemoSchema.safeParse("줄\n바꿈").success).toBe(true);
    expect(issuesOf(packingMemoSchema.safeParse("가".repeat(2001)))).toEqual([
      { path: [], message: "메모는 제어문자 없이 2000자 이내로 입력해 주세요." },
    ]);
  });
});
