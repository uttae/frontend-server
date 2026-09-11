import { expect, it } from "vitest";
import { resolveLeftSectionTargetMaxWidthPx } from "./mainChromeLayoutWidth";

it("reserves the labeled rail alongside 400px content and inline chat", () => {
  for (const pathname of ["/search", "/bookmark", "/member-settings", "/plan/room"]) {
    expect(resolveLeftSectionTargetMaxWidthPx({ pathname, contentWidthToken: "", chatState: "maximized", isMobile: false })).toBe(468);
  }
  expect(resolveLeftSectionTargetMaxWidthPx({ pathname: "/plan/room", contentWidthToken: "", chatState: "closed", isMobile: false })).toBe(720);
  expect(resolveLeftSectionTargetMaxWidthPx({ pathname: "/plan/room", contentWidthToken: "", chatState: "maximized", isMobile: true })).toBeNull();
});
