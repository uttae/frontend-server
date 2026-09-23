// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ maxWidth: "720px" }));
vi.mock("@/contexts/MobileViewContext", () => ({
  useMobileView: () => ({ isMobileDevice: false }),
}));
vi.mock("@/contexts/MainChromeLayoutWidthContext", () => ({
  useMainChromeLayoutWidth: () => ({
    setLeftSectionRef: () => {},
    leftSectionAnimateMaxWidth: state.maxWidth,
    leftSectionAnimateMinWidth: 0,
    layoutTransition: { duration: 0.01 },
  }),
}));

import LeftSection from "./LeftSection";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  state.maxWidth = "720px";
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

it("releases the bounded width when navigating to the full-width packing page", async () => {
  await act(async () => root.render(<LeftSection>내용</LeftSection>));
  expect(host.querySelector("section")?.style.maxWidth).toBe("720px");

  state.maxWidth = "none";
  await act(async () => root.render(<LeftSection>내용</LeftSection>));
  expect(host.querySelector("section")?.style.maxWidth).toBe("none");
});
