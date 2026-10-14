import { expect, it } from "vitest";
import { resolveLeftSectionTargetMaxWidthPx, resolveDesktopLeftSectionMinWidthPx } from "./mainChromeLayoutWidth";

it("keeps the schedule width across collaboration tabs and /chat, including page width effects", () => {
  for (const pathname of ["/plan", "/plan/room", "/chat", "/search", "/bookmark", "/bookmark/folder", "/member-settings", "/settings"]) {
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

it("keeps the 400px panel beside the rail and holds map-less tools at the full desktop minimum", () => {
  expect(resolveDesktopLeftSectionMinWidthPx("/plan/room")).toBe(469);
  expect(resolveDesktopLeftSectionMinWidthPx("/chat")).toBe(469);
  expect(resolveDesktopLeftSectionMinWidthPx("/cost")).toBe(849);
  expect(resolveDesktopLeftSectionMinWidthPx("/packing/room")).toBe(849);
  expect(resolveDesktopLeftSectionMinWidthPx("/packing/room", 440)).toBe(909);
});
