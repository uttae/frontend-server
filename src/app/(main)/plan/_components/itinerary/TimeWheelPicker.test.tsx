// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { TimeWheelPicker } from "./TimeWheelPicker";

it("alignment, focus and programmatic scrolling never turn the preview into a selection", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  const change = vi.fn();
  try {
    await act(async () => root.render(<TimeWheelPicker value={{ period: null, hour: null, minute: null }} onChange={change} active onSettlingChange={() => {}} />));
    const wheels = host.querySelectorAll<HTMLElement>('[role="listbox"]');
    expect(wheels).toHaveLength(3);
    await act(async () => {
      for (const wheel of wheels) {
        wheel.focus(); wheel.scrollTop = 40;
        wheel.dispatchEvent(new Event("scroll", { bubbles: true }));
        wheel.dispatchEvent(new Event("scrollend", { bubbles: true }));
      }
    });
    expect(change).not.toHaveBeenCalled();
    await act(async () => {
      wheels[0].dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      wheels[0].dispatchEvent(new Event("scrollend", { bubbles: true }));
    });
    expect(change).not.toHaveBeenCalled();
    const am = host.querySelector<HTMLButtonElement>('[data-value="AM"]')!;
    await act(async () => am.click());
    expect(change).toHaveBeenCalledExactlyOnceWith({ period: "AM", hour: null, minute: null });
  } finally {
    await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
  }
});
