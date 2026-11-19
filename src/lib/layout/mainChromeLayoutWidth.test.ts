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

it("keeps the 384px workspace beside the map and holds map-less tools at the 768px desktop minimum", () => {
  expect(resolveDesktopLeftSectionMinWidthPx("/plan/room")).toBe(384);
  expect(resolveDesktopLeftSectionMinWidthPx("/chat")).toBe(384);
  expect(resolveDesktopLeftSectionMinWidthPx("/cost")).toBe(768);
  expect(resolveDesktopLeftSectionMinWidthPx("/packing/room")).toBe(768);
});
