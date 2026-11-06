import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { sessionUserQueryKey } from "@/lib/query-keys";

vi.mock("@/lib/tab-id", () => ({ getTabId: () => "tab-a" }));

import { isOwnEcho } from "@/lib/stomp/own-echo";

const ME = 7;
const OTHER = 8;

describe("isOwnEcho", () => {
  const queryClient = new QueryClient();

  afterEach(() => {
    queryClient.clear();
  });

  it.each([
    // 탭 ID가 있으면 계정과 상관없이 탭으로만 판정한다
    { name: "this tab", originTabId: "tab-a", actorUserId: ME, expected: true },
    { name: "same account, other tab", originTabId: "tab-b", actorUserId: ME, expected: false },
    { name: "other account, other tab", originTabId: "tab-b", actorUserId: OTHER, expected: false },
    // 탭 ID가 없으면(옛 백엔드·HTTP 밖 변경) 계정으로 판정한다
    { name: "no tab ID, same account", originTabId: null, actorUserId: ME, expected: true },
    { name: "tab ID field missing, same account", originTabId: undefined, actorUserId: ME, expected: true },
    { name: "no tab ID, other account", originTabId: null, actorUserId: OTHER, expected: false },
  ])("$name → $expected", ({ originTabId, actorUserId, expected }) => {
    queryClient.setQueryData(sessionUserQueryKey, { id: ME });

    expect(isOwnEcho(queryClient, { actorUserId, originTabId })).toBe(expected);
  });

  it("treats an event without a tab ID as remote while the session user is unknown", () => {
    expect(isOwnEcho(queryClient, { actorUserId: ME, originTabId: null })).toBe(false);
  });
});
