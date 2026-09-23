import { expect, it } from "vitest";
import { resolveLeftSectionTargetMaxWidthPx } from "./mainChromeLayoutWidth";

it("keeps the schedule width across tabs and chat states, including page width effects", () => {
  for (const pathname of ["/plan", "/plan/room", "/search", "/bookmark", "/bookmark/folder", "/member-settings", "/room-settings", "/cost", "/settings"]) {
    for (const chatState of ["closed", "minimized", "maximized"] as const) {
      for (const contentWidthToken of ["", "400px"]) {
        expect(resolveLeftSectionTargetMaxWidthPx({ pathname, contentWidthToken, chatState, isMobile: false })).toBe(720);
        expect(resolveLeftSectionTargetMaxWidthPx({ pathname, contentWidthToken, chatState, isMobile: true })).toBeNull();
      }
    }
  }
});
