// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { TimeWheelPicker } from "./TimeWheelPicker";

it("the real wheel widget keeps empty parts on mount and focus without emitting a time", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  const change = vi.fn();
  try {
    await act(async () => root.render(<TimeWheelPicker value="" onChange={change} active onInteract={() => {}} />));
    const wheels = host.querySelectorAll<HTMLElement>("[data-rwp]");
    expect(wheels).toHaveLength(3);
    await act(async () => { wheels[0].focus(); wheels[1].focus(); wheels[2].focus(); });
    expect(change).not.toHaveBeenCalled();
    for (const selected of host.querySelectorAll("[data-rwp-highlight-list]")) expect(selected.textContent).toContain("--");
  } finally {
    await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
  }
});
