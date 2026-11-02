// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PlanDaySection } from "./PlanDaySection";

let host: HTMLDivElement;
let root: Root;
const outer = vi.fn();
const addDay = vi.fn();
const hostEvents = { onClick: outer, onMouseDown: outer, onPointerDown: outer, onTouchStart: outer };
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it("keeps menu trigger and portal actions out of the day host while retaining keyboard controls", async () => {
  await act(async () => root.render(
    <div {...hostEvents}>
      <PlanDaySection title="1일차" onRequestInsertScheduleAfter={addDay} />
    </div>,
  ));
  const trigger = document.querySelector<HTMLButtonElement>('[aria-label="일차 메뉴"]')!;
  for (const type of ["mousedown", "pointerdown", "touchstart"]) {
    await act(async () => trigger.dispatchEvent(new MouseEvent(type, { bubbles: true })));
  }
  await act(async () => trigger.click());
  expect(outer).not.toHaveBeenCalled();
  const item = document.querySelector<HTMLElement>('[role="menuitem"]')!;
  expect(item).not.toBeNull();
  for (const type of ["mousedown", "pointerdown", "touchstart"]) {
    await act(async () => item.dispatchEvent(new MouseEvent(type, { bubbles: true })));
  }
  await act(async () => item.click());
  expect(addDay).toHaveBeenCalledOnce();
  expect(outer).not.toHaveBeenCalled();
  await act(async () => trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true })));
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(document.querySelector('[aria-controls$="-panel"]')?.getAttribute("aria-expanded")).toBe("true");
});
