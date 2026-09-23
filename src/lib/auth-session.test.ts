import { describe, expect, it } from "vitest";

import {
  beginClientSessionReconciliationTransition,
  isProtectedAppPath,
  shouldReconcileClientSessionTransition,
} from "@/lib/auth-session";

describe("isProtectedAppPath", () => {
  it.each([
    "/home",
    "/home/new",
    "/plan",
    "/plan/room-1",
    "/bookmark",
    "/bookmark/folder-1",
    "/search",
    "/member-settings",
    "/room-settings",
    "/settings",
    "/waiting",
  ])("treats %s as a protected app URL", (pathname) => {
    expect(isProtectedAppPath(pathname)).toBe(true);
  });

  it.each(["/", "/terms", "/privacy", "/join/invite-code"])(
    "does not treat %s as a protected app URL",
    (pathname) => {
      expect(isProtectedAppPath(pathname)).toBe(false);
    },
  );
});

describe("shouldReconcileClientSessionTransition", () => {
  it.each([
    [null, "/", true],
    [null, "/login", false],
    ["/login", "/", true],
    ["/auth/callback", "/home", true],
    ["/home", "/plan/1", false],
    ["/login", "/auth/callback", false],
  ] as const)(
    "%s → %s 전환의 세션 조정 여부는 %s다",
    (previousPathname, pathname, expected) => {
      expect(
        shouldReconcileClientSessionTransition(previousPathname, pathname),
      ).toBe(expected);
    },
  );
});

describe("beginClientSessionReconciliationTransition", () => {
  it("skip 경로에서 일반 경로로 이동하면 pending 표시 후 세션을 조정한다", () => {
    const calls: string[] = [];

    const nextPreviousPathname =
      beginClientSessionReconciliationTransition({
        previousPathname: "/login",
        pathname: "/",
        markSessionPending: () => calls.push("pending"),
        reconcile: () => calls.push("reconcile"),
      });

    expect(calls).toEqual(["pending", "reconcile"]);
    expect(nextPreviousPathname).toBe("/");
  });

  it("일반 경로 사이의 이동은 세션을 다시 조정하지 않는다", () => {
    const calls: string[] = [];

    const nextPreviousPathname =
      beginClientSessionReconciliationTransition({
        previousPathname: "/home",
        pathname: "/plan/1",
        markSessionPending: () => calls.push("pending"),
        reconcile: () => calls.push("reconcile"),
      });

    expect(calls).toEqual([]);
    expect(nextPreviousPathname).toBe("/plan/1");
  });
});
