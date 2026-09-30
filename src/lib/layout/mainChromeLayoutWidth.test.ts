import { expect, it } from "vitest";
import { resolveLeftSectionTargetMaxWidthPx, resolveLeftSectionMinWidthPx } from "./mainChromeLayoutWidth";

it("keeps the schedule width across tabs and chat states, including page width effects", () => {
  for (const pathname of ["/plan", "/plan/room", "/search", "/bookmark", "/bookmark/folder", "/member-settings", "/room-settings", "/settings"]) {
    for (const chatState of ["closed", "minimized", "maximized"] as const) {
      for (const contentWidthToken of ["", "400px"]) {
        expect(resolveLeftSectionTargetMaxWidthPx({ pathname, contentWidthToken, chatState, isMobile: false })).toBe(720);
        expect(resolveLeftSectionTargetMaxWidthPx({ pathname, contentWidthToken, chatState, isMobile: true })).toBeNull();
      }
    }
  }
});

it("lets the ledger use the full desktop workspace", () => {
  expect(resolveLeftSectionTargetMaxWidthPx({ pathname: "/cost", contentWidthToken: "", chatState: "closed", isMobile: false })).toBeNull();
});
it("packing uses the full available desktop width until chat is maximized", () => {
  for (const chatState of ["closed", "minimized"] as const) {
    expect(resolveLeftSectionTargetMaxWidthPx({ pathname: "/packing/room", contentWidthToken: "400px", chatState, isMobile: false })).toBeNull();
  }
  expect(resolveLeftSectionTargetMaxWidthPx({ pathname: "/packing/room", contentWidthToken: "400px", chatState: "maximized", isMobile: false })).toBe(720);
});

it("removes the desktop minimum width only for packing", () => {
  expect(resolveLeftSectionMinWidthPx(false, "/packing/room")).toBe(0);
  expect(resolveLeftSectionMinWidthPx(false, "/packing/room", "maximized")).toBe(400);
  expect(resolveLeftSectionMinWidthPx(false, "/plan/room")).toBe(400);
  expect(resolveLeftSectionMinWidthPx(true, "/plan/room")).toBe(0);

});

it("keeps ledger full width when chat is minimized and uses docked width when maximized", () => {
  expect(resolveLeftSectionTargetMaxWidthPx({ pathname: "/cost", contentWidthToken: "", chatState: "minimized", isMobile: false })).toBeNull();
  expect(resolveLeftSectionTargetMaxWidthPx({ pathname: "/cost", contentWidthToken: "", chatState: "maximized", isMobile: false })).toBe(720);
});
