// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";

let host: HTMLDivElement;
let root: Root;
const nextFrame = () => act(async () => { await new Promise(resolve => requestAnimationFrame(() => resolve(null))); });
const renderDialog = (fixedWidth: boolean) => act(async () => root.render(
  <Dialog open>
    <DialogContent size="lg" fixedWidth={fixedWidth}>
      <DialogHeader><DialogTitle>비용 추가</DialogTitle></DialogHeader>
      <input aria-label="제목" />
    </DialogContent>
  </Dialog>,
));

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("puts a fixed-width dialog in a scrollable viewport and focuses its first control without scrolling", async () => {
  const focus = vi.spyOn(HTMLElement.prototype, "focus");
  await renderDialog(true);
  await nextFrame();
  const content = document.querySelector('[data-slot="dialog-content"]')!;
  expect(content.parentElement?.getAttribute("data-slot")).toBe("dialog-viewport");
  // 창보다 넓으면 첫 포커스(닫기 X)로 Viewport가 오른쪽 끝까지 밀려 제목이 가려지므로 스크롤 없이 포커스한다
  expect(document.activeElement).toBe(document.querySelector('button[aria-label="닫기"]'));
  expect(focus).toHaveBeenCalledWith({ preventScroll: true });
});

it("keeps other dialogs fixed to the window without a viewport", async () => {
  await renderDialog(false);
  await nextFrame();
  expect(document.querySelector('[data-slot="dialog-viewport"]')).toBeNull();
  expect(document.activeElement).toBe(document.querySelector('button[aria-label="닫기"]'));
});
