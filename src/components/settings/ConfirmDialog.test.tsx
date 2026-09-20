// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";
import { SettingsDialog } from "./SettingsDialog";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement;
let root: Root;
const outer = vi.fn();
const confirm = vi.fn();
const cancel = vi.fn();
const button = (name: string) => [...document.querySelectorAll<HTMLButtonElement>("button")]
  .find(node => node.textContent === name || node.getAttribute("aria-label") === name)!;
async function render(pending = false) {
  await act(async () => root.render(
    <div onClick={outer} onMouseDown={outer} onPointerDown={outer} onTouchStart={outer}>
      <ConfirmDialog title="삭제" description="설명" isPending={pending} onConfirm={confirm} onCancel={cancel} />
    </div>,
  ));
}
beforeEach(() => {
  vi.clearAllMocks();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it.each(["click", "mousedown", "pointerdown", "touchstart"])("contains %s from portal content and backdrop", async type => {
  await render();
  for (const target of [document.querySelector("p")!, button("삭제 배경 닫기")]) {
    await act(async () => target.dispatchEvent(new Event(type, { bubbles: true })));
  }
  expect(outer).not.toHaveBeenCalled();
});

it.each(["확인", "취소", "삭제 닫기", "삭제 배경 닫기"])("preserves the %s action", async name => {
  await render();
  await act(async () => button(name).click());
  expect(confirm).toHaveBeenCalledTimes(name === "확인" ? 1 : 0);
  expect(cancel).toHaveBeenCalledTimes(name === "확인" ? 0 : 1);
  expect(outer).not.toHaveBeenCalled();
});

it("keeps document Escape and Tab handling, contains focus and restores the trigger", async () => {
  const trigger = document.createElement("button");
  document.body.append(trigger); trigger.focus();
  await render();
  expect(document.activeElement).toBe(button("삭제 닫기"));
  expect(host.hasAttribute("inert")).toBe(true);
  await act(async () => {
    button("확인").focus();
    button("확인").dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
  });
  expect(document.activeElement).toBe(button("삭제 닫기"));
  await act(async () => button("삭제 닫기").dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true })));
  expect(document.activeElement).toBe(button("확인"));
  await act(async () => trigger.focus());
  expect(document.activeElement).toBe(button("삭제 닫기"));
  await act(async () => button("취소").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
  expect(cancel).toHaveBeenCalledTimes(1);
  await act(async () => root.render(null));
  expect(host.hasAttribute("inert")).toBe(false);
  expect(document.activeElement).toBe(trigger);
  trigger.remove();
});

it("uses current pending state without resetting focus and blocks all pending actions", async () => {
  await render(); button("취소").focus();
  await render(true);
  expect(document.activeElement).toBe(button("취소"));
  for (const name of ["처리 중…", "취소", "삭제 닫기", "삭제 배경 닫기"]) {
    await act(async () => button(name).click());
  }
  await act(async () => button("삭제 닫기").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(confirm).not.toHaveBeenCalled(); expect(cancel).not.toHaveBeenCalled();
});

it.each([false, true])("SettingsDialog portal containment is opt-in (%s)", async enabled => {
  await act(async () => root.render(
    <div onClick={outer}>
      <SettingsDialog title="설정" onClose={cancel} {...(enabled ? { stopPortalEventPropagation: true } : {})}>
        <button type="button" onClick={confirm}>실행</button>
      </SettingsDialog>
    </div>,
  ));
  await act(async () => button("실행").click());
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(outer).toHaveBeenCalledTimes(enabled ? 0 : 1);
});
