import { afterEach, describe, expect, it, vi } from "vitest";

import { readIsLandscapeOrientation } from "./orientation";

/** 테스트용 matchMedia — orientation·max-height 조건만 뷰포트 크기로 평가 */
function stubViewport(width: number, height: number) {
  vi.stubGlobal("window", {
    matchMedia: (query: string) => ({
      matches: query.split(/\s+and\s+/).every((part) => {
        const condition = part.trim();
        if (condition === "(orientation: landscape)") return width > height;
        const maxHeight = /^\(max-height: (\d+)px\)$/.exec(condition);
        if (maxHeight) return height <= Number(maxHeight[1]);
        throw new Error(`unsupported media condition: ${condition}`);
      }),
    }),
  });
}

describe("mobile landscape orientation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("treats a phone held sideways as landscape", () => {
    stubViewport(915, 360);
    expect(readIsLandscapeOrientation()).toBe(true);
  });

  it("keeps a phone held upright as portrait", () => {
    stubViewport(412, 780);
    expect(readIsLandscapeOrientation()).toBe(false);
  });

  it("does not rotate a near-square unfolded foldable whose browser chrome shortens the height", () => {
    stubViewport(884, 800);
    expect(readIsLandscapeOrientation()).toBe(false);
  });

  it("does not rotate a tablet held sideways", () => {
    stubViewport(1180, 740);
    expect(readIsLandscapeOrientation()).toBe(false);
  });
});
