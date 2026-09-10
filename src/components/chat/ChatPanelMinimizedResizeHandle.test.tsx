// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { ChatPanelMinimizedResizeHandle } from "./ChatPanelMinimizedResizeHandle";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
it("uses committed callbacks during a drag and cleans listeners/body style on unmount", async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  const first = vi.fn();
  const latest = vi.fn();
  const end = vi.fn();
  const render = async (onResize: typeof first) => {
    await act(async () =>
      root.render(
        <ChatPanelMinimizedResizeHandle
          size={{ width: 400, height: 500 }}
          onResize={onResize}
          onResizeEnd={end}
          clampSize={(width, height) => ({ width, height })}
        />,
      ),
    );
  };
  await render(first);
  const button = container.querySelector("button")!;
  button.setPointerCapture = vi.fn();
  const event = (type: string) => {
    const e = new MouseEvent(type, { bubbles: true, clientX: 20, clientY: 30 });
    Object.defineProperty(e, "pointerId", { value: 1 });
    return e;
  };
  await act(async () => button.dispatchEvent(event("pointerdown")));
  await render(latest);
  await act(async () => window.dispatchEvent(event("pointermove")));
  expect(latest).toHaveBeenCalledTimes(1);
  expect(first).not.toHaveBeenCalled();
  await act(async () => root.unmount());
  expect(document.body.style.userSelect).toBe("");
  window.dispatchEvent(event("pointermove"));
  window.dispatchEvent(event("pointerup"));
  expect(latest).toHaveBeenCalledTimes(1);
  expect(end).not.toHaveBeenCalled();
});
