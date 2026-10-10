// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ maxWidth: "720px" }));
vi.mock("@/contexts/MobileViewContext", () => ({
  useMobileView: () => ({ isMobileDevice: false }),
}));
vi.mock("@/contexts/MainChromeLayoutWidthContext", () => ({
  useMainChromeLayoutWidth: () => ({
    leftSectionAnimateMaxWidth: state.maxWidth,
    leftSectionAnimateMinWidth: 0,
    layoutTransition: { duration: 0.01, ease: [0.4, 0, 0.2, 1] },
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

function DraftEditor() {
  const [editing, setEditing] = useState(false);
  return (
    <>
      <button onClick={() => setEditing(true)}>편집</button>
      {editing ? <input aria-label="초안" defaultValue="저장 전 메모" /> : null}
    </>
  );
}

it("preserves drafts and the mounted page across bounded and unbounded widths", async () => {
  const render = () => root.render(<LeftSection><DraftEditor /></LeftSection>);
  await act(async () => render());
  await act(async () => host.querySelector("button")!.click());
  const input = host.querySelector("input")!;
  input.value = "작성 중인 메모";

  for (const maxWidth of ["none", "900px", "none"]) {
    state.maxWidth = maxWidth;
    await act(async () => render());
    expect(host.querySelector("input")).toBe(input);
    expect(input.value).toBe("작성 중인 메모");
  }
});
