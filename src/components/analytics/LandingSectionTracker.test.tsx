// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { analyticsConsentStore as consent } from "@/lib/analytics/consent-store";
import { LandingSectionTracker } from "./LandingSectionTracker";
const route = vi.hoisted(() => ({ pathname: "/" }));
const sink = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
vi.mock("@/lib/analytics/client", () => ({ sendAnalyticsDataCommand: sink }));
let root: Root;
let container: HTMLDivElement;
let top: number;
let height: number;
let foreground: boolean;
function render(pathname = "/") { route.pathname = pathname; act(() => root.render(<StrictMode><LandingSectionTracker /></StrictMode>)); }
function advance(ms: number) { act(() => vi.advanceTimersByTime(ms)); }
function visibility(visible: boolean) { foreground = visible; act(() => document.dispatchEvent(new Event("visibilitychange"))); }
function grant() { act(() => { consent.set("granted"); }); }
beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  // Deterministic rendering clock; geometry changes become observable on next frame.
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 10));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  top = 0; height = 600; foreground = true;
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => foreground ? "visible" : "hidden");
  vi.stubGlobal("innerHeight", 800);
  container = document.createElement("div"); document.body.append(container);
  const section = document.createElement("section"); section.dataset.landingSection = "hero";
  section.getBoundingClientRect = () => ({ top, bottom: top + height, height, left: 0, right: 600, width: 600, x: 0, y: top, toJSON: () => ({}) });
  document.body.append(section);
  root = createRoot(container);
  consent.set("denied"); render("/login"); render(); sink.mockClear();
});
afterEach(() => {
  act(() => root.unmount()); document.body.replaceChildren();
  vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});
it("counts at 1000ms, once across rescroll, rerender, remount and StrictMode", () => {
  grant(); advance(999); expect(sink).not.toHaveBeenCalled(); advance(1);
  expect(sink).toHaveBeenCalledExactlyOnceWith("event", "section_view", expect.objectContaining({ page_type: "landing", section_id: "hero" }));
  top = 900; advance(20); top = 0; advance(1100); render();
  act(() => root.unmount()); root = createRoot(container); render(); advance(1100);
  expect(sink).toHaveBeenCalledTimes(1);
});
it.each([[600, 500, true], [600, 501, false], [2000, -500, true], [2000, 400, true], [2000, 401, false], [0, 0, false]])("qualifies height=%i top=%i: %s", (h, t, qualifies) => {
  height = h; top = t; grant(); advance(1000);
  expect(sink).toHaveBeenCalledTimes(qualifies ? 1 : 0);
});
it("restarts continuous dwell after geometry interruption instead of accumulating", () => {
  grant(); advance(600); top = 900; advance(10); top = 0; advance(10);
  advance(999); expect(sink).not.toHaveBeenCalled(); advance(1); expect(sink).toHaveBeenCalledTimes(1);
});
it("resets on background and starts a fresh foreground interval", () => {
  grant(); advance(900); visibility(false); advance(2000); expect(sink).not.toHaveBeenCalled();
  visibility(true); advance(999); expect(sink).not.toHaveBeenCalled(); advance(1); expect(sink).toHaveBeenCalledTimes(1);
});
it("detects layout shifts and viewport resizing without a scroll", () => {
  top = 550; grant(); advance(1100); expect(sink).not.toHaveBeenCalled();
  vi.stubGlobal("innerHeight", 1000); window.dispatchEvent(new Event("resize")); advance(10);
  advance(1000); expect(sink).toHaveBeenCalledTimes(1);
});
it("resets an active interval when layout shifts below threshold", () => {
  grant(); advance(900); height = 2000; top = 500; advance(10); advance(200);
  expect(sink).not.toHaveBeenCalled(); top = 0; advance(10); advance(1000); expect(sink).toHaveBeenCalledTimes(1);
});
it("never accumulates denied time, revoke resets dwell, regrant never repeats counted sections", () => {
  advance(2000); expect(sink).not.toHaveBeenCalled(); grant(); advance(900);
  act(() => { consent.set("denied"); }); advance(2000); grant(); advance(999);
  expect(sink).not.toHaveBeenCalled(); advance(1); expect(sink).toHaveBeenCalledTimes(1);
  act(() => { consent.set("denied"); }); grant(); advance(2000); expect(sink).toHaveBeenCalledTimes(1);
});
it("pathname return creates a visit, query/hash changes keep the visit", () => {
  grant(); advance(1000);
  window.history.replaceState({}, "", "/?campaign=one#features"); render(); advance(1100);
  expect(sink).toHaveBeenCalledTimes(1);
  render("/login"); advance(1000); render(); advance(999); expect(sink).toHaveBeenCalledTimes(1);
  advance(1); expect(sink).toHaveBeenCalledTimes(2);
  window.history.replaceState({}, "", "/");
});
it("cancels pending dwell on pathname leave and component unmount", () => {
  grant(); advance(900); render("/login"); advance(200); expect(sink).not.toHaveBeenCalled();
  render(); advance(900); act(() => root.unmount()); advance(200); expect(sink).not.toHaveBeenCalled();
  root = createRoot(container); render(); advance(1000); expect(sink).toHaveBeenCalledTimes(1);
});
it("rechecks geometry at the deadline even before another animation frame", () => {
  grant(); advance(999); top = 900; advance(1); expect(sink).not.toHaveBeenCalled();
});
it("starts no dwell while initially backgrounded", () => {
  visibility(false); grant(); advance(2000); expect(sink).not.toHaveBeenCalled();
  visibility(true); advance(999); expect(sink).not.toHaveBeenCalled(); advance(1); expect(sink).toHaveBeenCalledTimes(1);
});
it("tracks complete sections independently and ignores unrecognized markup", () => {
  const hero = document.querySelector("section")!;
  for (const id of ["problem", "solution", "features", "devices", "travel_steps", "final_cta", "card_1"]) {
    const section = document.createElement("section"); section.dataset.landingSection = id;
    section.getBoundingClientRect = hero.getBoundingClientRect; document.body.append(section);
  }
  grant(); advance(1000);
  expect(sink.mock.calls.map(call => call[2].section_id)).toEqual(["hero", "problem", "solution", "features", "devices", "travel_steps", "final_cta"]);
});
it("a fresh module/document lifetime allows a new view after refresh", async () => {
  grant(); advance(1000); expect(sink).toHaveBeenCalledTimes(1);
  act(() => root.unmount()); vi.resetModules();
  const { analyticsConsentStore: freshConsent } = await import("@/lib/analytics/consent-store");
  const { LandingSectionTracker: FreshTracker } = await import("./LandingSectionTracker");
  freshConsent.set("granted"); root = createRoot(container);
  act(() => root.render(<FreshTracker />)); advance(1000); expect(sink).toHaveBeenCalledTimes(2);
});
