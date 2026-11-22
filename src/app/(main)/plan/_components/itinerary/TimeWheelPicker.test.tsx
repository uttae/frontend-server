// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { TimeWheelPicker } from "./TimeWheelPicker";

it("alignment, focus and programmatic scrolling never turn the preview into a selection", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const change = vi.fn();
  try {
    await act(async () =>
      root.render(
        <TimeWheelPicker
          value={{ period: null, hour: null, minute: null }}
          onChange={change}
          active
          onSettlingChange={() => {}}
        />,
      ),
    );
    const wheels = host.querySelectorAll<HTMLElement>('[role="listbox"]');
    expect(wheels).toHaveLength(3);
    await act(async () => {
      for (const wheel of wheels) {
        wheel.focus();
        wheel.scrollTop = 40;
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
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});

it("commits a user scroll after settling and keeps the latest selection callback", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const initialChange = vi.fn();
  const latestChange = vi.fn();
  const settling = vi.fn();
  const value = { period: null, hour: null, minute: null };
  try {
    await act(async () =>
      root.render(<TimeWheelPicker value={value} onChange={initialChange} active onSettlingChange={settling} />),
    );
    const wheel = host.querySelector<HTMLElement>('[role="listbox"]')!;
    await act(async () => {
      wheel.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      wheel.scrollTop = 40;
      wheel.dispatchEvent(new Event("scroll"));
    });
    expect(settling).toHaveBeenLastCalledWith(true);
    expect(initialChange).not.toHaveBeenCalled();
    await act(async () =>
      root.render(<TimeWheelPicker value={value} onChange={latestChange} active onSettlingChange={settling} />),
    );
    await act(async () => wheel.dispatchEvent(new Event("scrollend")));
    expect(initialChange).not.toHaveBeenCalled();
    expect(latestChange).toHaveBeenCalledExactlyOnceWith({ period: "PM", hour: null, minute: null });
    expect(settling).toHaveBeenLastCalledWith(false);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
