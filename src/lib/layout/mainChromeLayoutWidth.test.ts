import { expect, it } from "vitest";
import { resolveLeftSectionTargetMaxWidthPx, resolveLeftSectionMinWidthPx } from "./mainChromeLayoutWidth";

it("keeps the schedule width across tabs and chat states, including page width effects", () => {
  for (const pathname of ["/plan", "/plan/room", "/search", "/bookmark", "/bookmark/folder", "/member-settings", "/room-settings", "/cost", "/settings", "/contact"]) {
    for (const chatState of ["closed", "minimized", "maximized"] as const) {
      for (const contentWidthToken of ["", "400px"]) {
        expect(resolveLeftSectionTargetMaxWidthPx({ pathname, contentWidthToken, chatState, isMobile: false })).toBe(720);
        expect(resolveLeftSectionTargetMaxWidthPx({ pathname, contentWidthToken, chatState, isMobile: true })).toBeNull();
      }
    }
  }
});
it("only packing uses the full available desktop width", () => {
  for (const chatState of ["closed", "minimized", "maximized"] as const) {
    expect(resolveLeftSectionTargetMaxWidthPx({ pathname: "/packing/room", contentWidthToken: "400px", chatState, isMobile: false })).toBeNull();
  }
});

it("removes the desktop minimum width only for packing", () => {
  expect(resolveLeftSectionMinWidthPx(false, "/packing/room")).toBe(0);
  expect(resolveLeftSectionMinWidthPx(false, "/plan/room")).toBe(400);
  expect(resolveLeftSectionMinWidthPx(true, "/plan/room")).toBe(0);
});
