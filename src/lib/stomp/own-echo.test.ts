import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { sessionUserQueryKey } from "@/lib/query-keys";

const tab = vi.hoisted(() => ({ id: "tab-a" as string | null }));

vi.mock("@/lib/tab-id", () => ({ getTabId: () => tab.id }));

import { isOwnEcho } from "@/lib/stomp/own-echo";

const ME = 7;
const OTHER = 8;

describe("isOwnEcho", () => {
  const queryClient = new QueryClient();

  afterEach(() => {
    queryClient.clear();
    tab.id = "tab-a";
  });

  it.each([
    { name: "sent from this tab by me", originTabId: "tab-a", actorUserId: ME, expected: true },
    { name: "sent from another tab of my account", originTabId: "tab-b", actorUserId: ME, expected: false },
    // 탭 ID는 방 멤버 모두에게 보여 흉내 낼 수 있다 — 다른 계정이면 반향이 아니다
    { name: "my tab ID forged by another account", originTabId: "tab-a", actorUserId: OTHER, expected: false },
    // 탭 ID가 없으면 어느 탭 것인지 몰라 놓치지 않도록 받는다
    { name: "no tab ID", originTabId: null, actorUserId: ME, expected: false },
    { name: "tab ID field missing", originTabId: undefined, actorUserId: ME, expected: false },
    { name: "empty tab ID", originTabId: "", actorUserId: ME, expected: false },
  ])("$name → $expected", ({ originTabId, actorUserId, expected }) => {
    queryClient.setQueryData(sessionUserQueryKey, { id: ME });

    expect(isOwnEcho(queryClient, { actorUserId, originTabId })).toBe(expected);
  });

  it("does not match a tab-less event in a tab that could not make an ID", () => {
    tab.id = null;
    queryClient.setQueryData(sessionUserQueryKey, { id: ME });

    expect(isOwnEcho(queryClient, { actorUserId: ME, originTabId: null })).toBe(false);
  });

  it("receives this tab's change while the session user is not loaded yet", () => {
    expect(isOwnEcho(queryClient, { actorUserId: ME, originTabId: "tab-a" })).toBe(false);
  });
});
