// @vitest-environment jsdom
import { act, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { MobileViewProvider, useMobileView } from "./MobileViewContext";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
it("preserves the context value when a resize does not change the device flag", async () => {
  const removeListener = vi.spyOn(window, "removeEventListener");
  const committed = vi.fn();
  function Probe() { const value = useMobileView(); useLayoutEffect(() => { committed(value); }); return null; }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(<MobileViewProvider><Probe /></MobileViewProvider>));
  const count = committed.mock.calls.length;
  await act(async () => window.dispatchEvent(new Event("resize")));
  expect(committed).toHaveBeenCalledTimes(count);
  await act(async () => root.unmount());
  expect(removeListener).toHaveBeenCalledWith("resize", expect.any(Function));
  removeListener.mockRestore();
  vi.unstubAllGlobals();
});
