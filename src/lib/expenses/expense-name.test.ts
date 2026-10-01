import { expect, it, vi } from "vitest";
vi.mock("@/lib/api/config", () => ({ API_BASE: "http://fixture" }));
import { normalizeExpenseName, expenseTitle, expenseNameError } from "./expense-name";
it("uses Java whitespace, retains NBSP/internal whitespace and never persists the category fallback", () => {
  for (const name of [undefined, null, "", " \t\n\u001c\u3000"]) expect(normalizeExpenseName(name)).toBeNull();
  expect(normalizeExpenseName(" \u3000점심  식사\n")).toBe("점심  식사");
  expect(normalizeExpenseName("\u00a0")).toBe("\u00a0");
  expect(expenseTitle({ name: null, category: "FOOD" })).toBe("식비");
  expect(expenseTitle({ name: "점심", category: "FOOD" })).toBe("점심");
});
it("validates raw UTF16 length before stripping, including surrogate pairs", () => {
  expect(expenseNameError("😀".repeat(50))).toBeNull();
  expect(expenseNameError("😀".repeat(50) + " ")).toBeTruthy();
  expect(expenseNameError(" ".repeat(101))).toBeTruthy();
});

it("strips long whitespace edges without changing internal or non-Java spaces", () => {
  const padding = " ".repeat(100_000);
  expect(normalizeExpenseName(padding + "점심  식사" + padding)).toBe("점심  식사");
  expect(normalizeExpenseName("x" + padding + "y")).toBe("x" + padding + "y");
  for (const space of ["\u00a0", "\u2007", "\u202f"]) {
    expect(normalizeExpenseName(padding + space + padding)).toBe(space);
  }
});
