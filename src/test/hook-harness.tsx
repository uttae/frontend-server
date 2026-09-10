import { act, useLayoutEffect, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

export function hookHarness<P, R>(
  useValue: (props: P) => R,
  wrap: (child: ReactNode) => ReactNode = (child) => child,
) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let value: R;
  function Probe({ args }: { args: P }) {
    const next = useValue(args);
    useLayoutEffect(() => {
      value = next;
    });
    return null;
  }
  return {
    get current() {
      return value;
    },
    async render(args: P) {
      await act(async () => {
        root.render(wrap(<Probe args={args} />));
      });
    },
    async flush() {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    },
    async unmount() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}
