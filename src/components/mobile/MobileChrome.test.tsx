// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MobileChrome } from "./MobileChrome";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let container: HTMLDivElement;
let direction: EventTarget & { type: string; lock: ReturnType<typeof vi.fn> };

beforeEach(() => {
  direction = Object.assign(new EventTarget(), {
    type: "portrait-primary", lock: vi.fn().mockResolvedValue(undefined),
  });
  vi.stubGlobal("screen", { orientation: direction, width: 1300, height: 600 });
  vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Linux; Android 13) Mobile", maxTouchPoints: 5 });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  document.documentElement.classList.remove("is-mobile-device");
  vi.unstubAllGlobals();
});

async function renderChrome() {
  await act(async () => root.render(<MobileChrome><textarea defaultValue="여행 메모" /></MobileChrome>));
}

function expectNoForcedTransform(element: Element) {
  for (let parent: Element | null = element; parent && parent !== container; parent = parent.parentElement) {
    expect(["", "none"]).toContain(getComputedStyle(parent).transform);
  }
}

it.each(["portrait-primary", "landscape-primary", "landscape-secondary"])(
  "renders mobile content without rotating or locking the screen in %s",
  async (type) => {
    direction.type = type;
    await renderChrome();
    expect(document.documentElement.classList.contains("is-mobile-device")).toBe(true);
    expectNoForcedTransform(container.querySelector("textarea")!);
    expect(direction.lock).not.toHaveBeenCalled();
  },
);

it("preserves the focused draft across device rotations and keyboard resizes", async () => {
  await renderChrome();
  const input = container.querySelector("textarea")!;
  input.value = "작성 중인 메모";
  input.focus();
  for (const [type, width, height] of [
    ["landscape-primary", 1300, 600],
    ["portrait-primary", 884, 800],
    ["portrait-primary", 884, 480],
  ] as const) {
    await act(async () => {
      direction.type = type;
      vi.stubGlobal("innerWidth", width);
      vi.stubGlobal("innerHeight", height);
      direction.dispatchEvent(new Event("change"));
      window.dispatchEvent(new Event("orientationchange"));
      window.dispatchEvent(new Event("resize"));
    });
    expect(container.querySelector("textarea")).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe("작성 중인 메모");
    expectNoForcedTransform(input);
  }
  expect(direction.lock).not.toHaveBeenCalled();
});
