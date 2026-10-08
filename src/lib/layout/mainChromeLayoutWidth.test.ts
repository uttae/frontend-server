import { expect, it } from "vitest";
import { resolveLeftSectionTargetMaxWidthPx, resolveLeftSectionMinWidthPx } from "./mainChromeLayoutWidth";

it("keeps the schedule width across collaboration tabs and /chat, including page width effects", () => {
  for (const pathname of ["/plan", "/plan/room", "/chat", "/search", "/bookmark", "/bookmark/folder", "/member-settings", "/room-settings", "/settings"]) {
    for (const contentWidthToken of ["", "400px"]) {
      expect(resolveLeftSectionTargetMaxWidthPx({ pathname, contentWidthToken, isMobile: false })).toBe(720);
      expect(resolveLeftSectionTargetMaxWidthPx({ pathname, contentWidthToken, isMobile: true })).toBeNull();
    }
  }
});

it("lets the ledger and packing use the full desktop workspace", () => {
  expect(resolveLeftSectionTargetMaxWidthPx({ pathname: "/cost", contentWidthToken: "", isMobile: false })).toBeNull();
  expect(resolveLeftSectionTargetMaxWidthPx({ pathname: "/packing/room", contentWidthToken: "400px", isMobile: false })).toBeNull();
});

it("removes the desktop minimum width only for packing", () => {
  expect(resolveLeftSectionMinWidthPx(false, "/packing/room")).toBe(0);
  expect(resolveLeftSectionMinWidthPx(false, "/plan/room")).toBe(400);
  expect(resolveLeftSectionMinWidthPx(false, "/chat")).toBe(400);
  expect(resolveLeftSectionMinWidthPx(true, "/plan/room")).toBe(0);
});
