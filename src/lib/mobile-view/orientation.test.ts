// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { readIsLandscapeOrientation, readIsMobileLandscape } from "./orientation";

afterEach(() => vi.unstubAllGlobals());

it.each([800, 480])(
  "keeps an unfolded portrait Fold upright when browser UI leaves a viewport height of %s",
  (height) => {
    // PR #210의 884 x 800 재현 조건과 키보드로 더 줄어든 조건.
    vi.stubGlobal("screen", {
      orientation: { type: "portrait-primary" }, width: 884, height: 1061,
    });
    vi.stubGlobal("innerWidth", 884);
    vi.stubGlobal("innerHeight", height);
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.split(/\s+and\s+/).every((condition) => {
        if (condition === "(orientation: landscape)") return 884 > height;
        const maxHeight = /^\(max-height: (\d+)px\)$/.exec(condition);
        if (maxHeight) return height <= Number(maxHeight[1]);
        throw new Error(`Unexpected media query: ${query}`);
      }),
    }));
    expect(readIsLandscapeOrientation()).toBe(false);
  },
);

it.each(["portrait-primary", "portrait-secondary"])(
  "does not rotate %s when the keyboard makes the viewport landscape",
  (type) => {
    vi.stubGlobal("screen", { orientation: { type }, width: 390, height: 844 });
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    expect(readIsLandscapeOrientation()).toBe(false);
  },
);

it.each(["landscape-primary", "landscape-secondary"])(
  "detects %s independently of viewport dimensions",
  (type) => {
    vi.stubGlobal("screen", { orientation: { type }, width: 844, height: 390 });
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    expect(readIsLandscapeOrientation()).toBe(true);
  },
);

it.each([[0, false], [180, false], [90, true], [-90, true]])(
  "supports legacy iOS orientation %s without using keyboard dimensions",
  (angle, expected) => {
    vi.stubGlobal("screen", { width: 390, height: 844 });
    vi.stubGlobal("orientation", angle);
    vi.stubGlobal("matchMedia", () => ({ matches: !expected }));
    expect(readIsLandscapeOrientation()).toBe(expected);
  },
);

it.each([[390, 844, false], [844, 390, true], [0, 0, false]])(
  "uses screen dimensions when direction APIs are unavailable (%s x %s)",
  (width, height, expected) => {
    vi.stubGlobal("screen", { width, height });
    vi.stubGlobal("orientation", undefined);
    vi.stubGlobal("matchMedia", () => ({ matches: !expected }));
    expect(readIsLandscapeOrientation()).toBe(expected);
  },
);

it("does not apply mobile rotation to desktop browsers", () => {
  vi.stubGlobal("screen", { orientation: { type: "landscape-primary" } });
  vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (X11; Linux x86_64)" });
  expect(readIsMobileLandscape()).toBe(false);
});
