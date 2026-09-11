// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LandingView } from "./LandingView";
const sink = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/client", () => ({ sendAnalyticsDataCommand: sink }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/layout/SiteFooter", () => ({ SiteFooter: () => <footer /> }));
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div"); document.body.append(container);
  root = createRoot(container); sink.mockClear();
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
it("emits exact CTA roles for real activations only, preserves reclicks, modifiers and native keyboard click", () => {
  act(() => root.render(<StrictMode><LandingView /></StrictMode>));
  expect(sink).not.toHaveBeenCalled();
  const links = [...container.querySelectorAll<HTMLAnchorElement>('a[href="/login"]')];
  expect(links).toHaveLength(3);
  for (const [index, link] of links.entries()) {
    // Observe defaultPrevented before cancelling jsdom's unavailable navigation.
    const prevented: boolean[] = [];
    const preventNavigation = (event: Event) => { prevented.push(event.defaultPrevented); event.preventDefault(); };
    document.addEventListener("click", preventNavigation);
    const beforeKeys = sink.mock.calls.length;
    act(() => {
      link.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      link.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true }));
      link.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    });
    expect(sink).toHaveBeenCalledTimes(beforeKeys);
    for (const options of [{ detail: 1 }, { detail: 1 }, { detail: 0 }, { ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }]) {
      act(() => { link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...options })); });
    }
    act(() => { link.dispatchEvent(new MouseEvent("auxclick", { bubbles: true, button: 1 })); });
    act(() => { link.dispatchEvent(new MouseEvent("auxclick", { bubbles: true, button: 2 })); });
    document.removeEventListener("click", preventNavigation);
    expect(prevented).toEqual(Array(7).fill(false));
    const calls = sink.mock.calls.slice(index * 8, (index + 1) * 8);
    expect(calls).toHaveLength(8);
    for (const call of calls) expect(call).toEqual(["event", "cta_click", expect.objectContaining({
      page_type: "landing", cta_id: index === 0 ? "login" : "start_trip", cta_position: ["header", "hero", "final"][index],
    })]);
  }
  expect(sink).toHaveBeenCalledTimes(24);
});
it("marks seven complete semantic sections without tracking header/footer or cards", () => {
  act(() => root.render(<LandingView />));
  expect([...container.querySelectorAll("[data-landing-section]")].map(el => [el.tagName, el.getAttribute("data-landing-section")])).toEqual([
    ["SECTION", "hero"], ["SECTION", "problem"], ["SECTION", "solution"], ["SECTION", "features"], ["SECTION", "devices"], ["SECTION", "travel_steps"], ["SECTION", "final_cta"],
  ]);
});
