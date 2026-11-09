// @vitest-environment jsdom
import { beforeEach, expect, it } from "vitest";
import { consumePendingInviteCode, pendingInviteAuthPath, setPendingInviteCode } from "./session-user-flow";

beforeEach(() => sessionStorage.clear());
it("preserves an invite campaign across login and agreements until consumed", () => {
  setPendingInviteCode("test-invite", "?utm_source=partner&utm_campaign=launch&code=secret");
  expect(pendingInviteAuthPath("/login")).toBe("/login?utm_source=partner&utm_campaign=launch");
  expect(pendingInviteAuthPath("/login/agreements")).toBe("/login/agreements?utm_source=partner&utm_campaign=launch");
  expect(consumePendingInviteCode()).toBe("test-invite");
  expect(pendingInviteAuthPath("/login")).toBe("/login");
  expect(consumePendingInviteCode()).toBeNull();
});
it("replaces the entire old campaign when a different invitation arrives", () => {
  setPendingInviteCode("first", "?utm_source=partner&utm_medium=email");
  setPendingInviteCode("second", "?utm_campaign=partial");
  expect(pendingInviteAuthPath("/login")).toBe("/login?utm_campaign=partial");
  setPendingInviteCode("third");
  expect(pendingInviteAuthPath("/login")).toBe("/login");
  expect(consumePendingInviteCode()).toBe("third");
});
it("does not add a default campaign to a legacy or general login", () => {
  expect(pendingInviteAuthPath("/login?error=OAuthCallback")).toBe("/login?error=OAuthCallback");
  sessionStorage.setItem("pendingInviteCode", "legacy");
  expect(pendingInviteAuthPath("/login")).toBe("/login");
});
