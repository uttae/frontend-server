// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement;
let root: Root;
const outer = vi.fn();
const confirm = vi.fn();
const cancel = vi.fn();
// 접근성 이름: aria-labelledby(Button loading이면 loadingLabel span) → aria-label → 글자 순서
function accessibleName(node: Element) {
  const labelledBy = node.getAttribute("aria-labelledby");
  if (labelledBy) return labelledBy.split(" ").map(id => document.getElementById(id)?.textContent ?? "").join(" ");
  return node.getAttribute("aria-label") ?? node.textContent ?? "";
}
const buttons = () => [...document.querySelectorAll<HTMLButtonElement>("button")];
const button = (name: string) => buttons().find(node => accessibleName(node) === name)!;
// Base UI는 첫 포커스·포커스 복귀를 다음 프레임에 한다
const nextFrame = () => act(async () => { await new Promise(resolve => requestAnimationFrame(() => resolve(null))); });
const escape = () => act(async () => {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
});
async function render({ pending = false, confirmDisabled = false } = {}) {
  await act(async () => root.render(
    <div onClick={outer} onMouseDown={outer} onPointerDown={outer} onTouchStart={outer}>
      <ConfirmDialog title="삭제" description="설명" isPending={pending} confirmDisabled={confirmDisabled}
        onConfirm={confirm} onCancel={cancel} />
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

it("is a modal alert dialog without a close X", async () => {
  await render();
  const dialog = document.querySelector('[role="alertdialog"]')!;
  expect(dialog.hasAttribute("data-open")).toBe(true);
  expect(accessibleName(dialog)).toBe("삭제");
  expect(buttons().map(accessibleName)).not.toContain("삭제 닫기");
});

it.each(["확인", "취소", "삭제 배경 닫기"])("preserves the %s action", async name => {
  await render();
  await act(async () => button(name).click());
  expect(confirm).toHaveBeenCalledTimes(name === "확인" ? 1 : 0);
  expect(cancel).toHaveBeenCalledTimes(name === "확인" ? 0 : 1);
  expect(outer).not.toHaveBeenCalled();
});

it("focuses cancel first, hides the page behind it, closes with document Escape and restores the trigger", async () => {
  const trigger = document.createElement("button");
  document.body.append(trigger); trigger.focus();
  await render();
  await nextFrame();
  // 첫 포커스는 취소(Enter 한 번에 확인이 실행되지 않게). 바깥 요소는 Base UI가 aria-hidden으로 가린다
  expect(document.activeElement).toBe(button("취소"));
  expect(host.getAttribute("aria-hidden")).toBe("true");
  expect(trigger.getAttribute("aria-hidden")).toBe("true");
  await escape();
  expect(cancel).toHaveBeenCalledTimes(1);
  await act(async () => root.render(null));
  await nextFrame();
  expect(host.hasAttribute("aria-hidden")).toBe(false);
  expect(document.activeElement).toBe(trigger);
  trigger.remove();
});

it("shows progress while pending and blocks confirm, cancel, backdrop and Escape", async () => {
  await render(); await nextFrame(); button("확인").focus();
  await render({ pending: true });
  await nextFrame();
  // 누른 확인 버튼에 포커스가 남는다(progress 중에도 focusable, 첫 포커스로 되돌리지 않음)
  const action = button("처리 중");
  expect(document.activeElement).toBe(action);
  expect(action).toBeDefined();
  expect(action.getAttribute("aria-busy")).toBe("true");
  expect(action.getAttribute("aria-disabled")).toBe("true");
  expect(buttons().map(accessibleName)).not.toContain("확인");
  for (const name of ["처리 중", "취소", "삭제 배경 닫기"]) {
    await act(async () => button(name).click());
  }
  await escape();
  expect(confirm).not.toHaveBeenCalled(); expect(cancel).not.toHaveBeenCalled();
  expect(document.querySelector('[role="alertdialog"]')?.hasAttribute("data-open")).toBe(true);
});

it("disables only the confirm button when confirmDisabled", async () => {
  await render({ confirmDisabled: true });
  expect(button("확인").disabled).toBe(true);
  await act(async () => button("확인").click());
  expect(confirm).not.toHaveBeenCalled();
  await act(async () => button("취소").click());
  expect(cancel).toHaveBeenCalledTimes(1);
});
