// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MobileViewProvider } from "@/contexts/MobileViewContext";
import { MobilePortraitShell } from "./MobilePortraitShell";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let container: HTMLDivElement;
let direction: EventTarget & { type: string };
let media: EventTarget & { matches: boolean };

beforeEach(() => {
  direction = Object.assign(new EventTarget(), { type: "portrait-primary" });
  media = Object.assign(new EventTarget(), { matches: false });
  vi.stubGlobal("screen", { orientation: direction, width: 390, height: 844 });
  vi.stubGlobal("navigator", { userAgent: "iPhone", maxTouchPoints: 5 });
  vi.stubGlobal("matchMedia", () => media);
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

async function renderShell() {
  await act(async () => root.render(
    <MobileViewProvider><MobilePortraitShell><textarea defaultValue="여행 메모" /></MobilePortraitShell></MobileViewProvider>,
  ));
}

it("keeps the focused draft mounted and upright when the keyboard changes viewport orientation", async () => {
  await renderShell();
  const input = container.querySelector("textarea")!;
  input.value = "작성 중인 메모";
  input.focus();
  await act(async () => {
    media.matches = true;
    media.dispatchEvent(new Event("change"));
    window.dispatchEvent(new Event("resize"));
  });
  expect(container.querySelector("[data-mobile-portrait-rotate]")).toBeNull();
  expect(container.querySelector("textarea")).toBe(input);
  expect(document.activeElement).toBe(input);
  expect(input.value).toBe("작성 중인 메모");
});

it("updates the shell on actual screen rotation even without a viewport resize", async () => {
  await renderShell();
  await act(async () => {
    direction.type = "landscape-primary";
    direction.dispatchEvent(new Event("change"));
  });
  expect(container.querySelector("[data-mobile-portrait-rotate]")).not.toBeNull();
  await act(async () => {
    direction.type = "portrait-primary";
    direction.dispatchEvent(new Event("change"));
  });
  expect(container.querySelector("[data-mobile-portrait-rotate]")).toBeNull();
});

it("updates on the legacy iOS orientationchange event", async () => {
  vi.stubGlobal("screen", { width: 390, height: 844 });
  vi.stubGlobal("orientation", 0);
  await renderShell();
  await act(async () => {
    vi.stubGlobal("orientation", 90);
    window.dispatchEvent(new Event("orientationchange"));
  });
  expect(container.querySelector("[data-mobile-portrait-rotate]")).not.toBeNull();
});
