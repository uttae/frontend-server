import { describe, expect, it, vi } from "vitest";

const tab = vi.hoisted(() => ({ id: "tab-a" as string | null }));

vi.mock("@/lib/tab-id", () => ({ getTabId: () => tab.id }));

import { isOwnEcho } from "@/lib/stomp/own-echo";

describe("isOwnEcho", () => {
  it.each([
    { name: "sent from this tab", originTabId: "tab-a", expected: true },
    { name: "sent from another tab", originTabId: "tab-b", expected: false },
    // 탭 ID가 없으면 어느 탭 것인지 몰라 놓치지 않도록 받는다
    { name: "no tab ID", originTabId: null, expected: false },
    { name: "tab ID field missing", originTabId: undefined, expected: false },
    { name: "empty tab ID", originTabId: "", expected: false },
  ])("$name → $expected", ({ originTabId, expected }) => {
    tab.id = "tab-a";

    expect(isOwnEcho({ originTabId })).toBe(expected);
  });

  it("does not match a tab-less event in a tab that could not make an ID", () => {
    tab.id = null;

    expect(isOwnEcho({ originTabId: null })).toBe(false);
  });
});
