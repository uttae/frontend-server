// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ExpenseDialog } from "./ExpenseDialog";

let root: Root;
let container: HTMLDivElement;
const close = vi.fn();
const capture = vi.fn();
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  HTMLElement.prototype.setPointerCapture = capture;
  HTMLElement.prototype.hasPointerCapture = () => true;
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  close.mockReset(); capture.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<ExpenseDialog title="정산" onClose={close}><input aria-label="내용" /></ExpenseDialog>));
});
afterEach(() => { act(() => root.unmount()); container.remove(); document.documentElement.className = ""; vi.unstubAllGlobals(); });
function pointer(target: Element, type: string, y: number, x = 20) {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: y });
  act(() => target.dispatchEvent(event));
}
function drag(distance: number, end = "pointerup", target: Element = container.querySelector("header")!) {
  pointer(target, "pointerdown", 20);
  pointer(target, "pointermove", 20 + distance);
  pointer(target, end, 20 + distance);
}
it("follows a downward header gesture and dismisses after a deliberate drag", () => {
  const header = container.querySelector("header")!;
  pointer(header, "pointerdown", 20);
  pointer(header, "pointermove", 140);
  expect(container.querySelector("dialog")!.style.transform).toBe("translateY(120px)");
  pointer(header, "pointerup", 140);
  expect(close).toHaveBeenCalledOnce();
});
it.each([[30, "pointerup"], [130, "pointercancel"], [-100, "pointerup"]])("snaps back for %s px and %s", (distance, end) => {
  drag(Number(distance), String(end));
  expect(close).not.toHaveBeenCalled();
  expect(container.querySelector("dialog")!.style.transform).not.toContain("translateY(");
});
it("ignores desktop drags but supports wide mobile devices", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  drag(130);
  expect(close).not.toHaveBeenCalled();
  document.documentElement.classList.add("is-mobile-device");
  drag(130);
  expect(close).toHaveBeenCalledOnce();
});
it("does not intercept buttons or form input gestures", () => {
  drag(130, "pointerup", container.querySelector("button")!);
  drag(130, "pointerup", container.querySelector("input")!);
  expect(close).not.toHaveBeenCalled();
  expect(capture).not.toHaveBeenCalled();
});
it("ignores a horizontal gesture", () => {
  const header = container.querySelector("header")!;
  pointer(header, "pointerdown", 20);
  pointer(header, "pointermove", 140, 240);
  pointer(header, "pointerup", 140, 240);
  expect(close).not.toHaveBeenCalled();
});

// Only data dependencies are stubbed; editor rendering and pointer handling stay real.
const editorState = vi.hoisted(() => ({ busy: false }));
vi.mock("./ExpenseProvider", () => ({ useExpenseContext: () => ({
  roomId: "room", currentUserId: 1, canManage: true, busy: editorState.busy,
  members: [{ userId: 1, nickname: "나", status: "ACTIVE", role: "MEMBER" }],
  memberStatus: "success", schedules: [], schedulesReady: true,
  currencies: { isSuccess: true, data: [{ currency: "KRW", fractionDigits: 0, maximumAmount: "999999999999999" }] },
}) }));
vi.mock("@/hooks/useRooms", () => ({ useSchedulePlanPlaces: () => ({ data: [], isSuccess: true }) }));
import { ExpenseEditor } from "./ExpenseEditor";

it("never dismisses the editor when a save is pending, including a save starting mid-drag", () => {
  editorState.busy = false;
  act(() => root.render(<ExpenseEditor initial={{}} onClose={close} />));
  const title = container.querySelector("h2")!;
  pointer(title, "pointerdown", 20);
  pointer(title, "pointermove", 140);
  editorState.busy = true;
  act(() => root.render(<ExpenseEditor initial={{}} onClose={close} />));
  pointer(title, "pointerup", 140);
  expect(close).not.toHaveBeenCalled();
  expect(container.querySelector("dialog")!.style.transform).toBe("");
  drag(130, "pointerup", title);
  expect(close).not.toHaveBeenCalled();
  editorState.busy = false;
  act(() => root.render(<ExpenseEditor initial={{}} onClose={close} />));
  drag(130, "pointerup", title);
  expect(close).toHaveBeenCalledOnce();
});

it.each(["pointerup", "pointercancel"])("does not restart the editor entrance animation after %s", (end) => {
  editorState.busy = false;
  act(() => root.render(<ExpenseEditor initial={{}} onClose={close} />));
  drag(30, end, container.querySelector("h2")!);
  expect(container.querySelector("dialog")!.style.animation).toBe("none");
  expect(close).not.toHaveBeenCalled();
});
it("snaps back without animation when reduced motion is requested", () => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion") || query.includes("max-width") }));
  drag(30);
  expect(container.querySelector("dialog")!.style.transition).toBe("none");
});

import { ExpenseScopePanel } from "./ExpenseScopePanel";
function mountScope() {
  act(() => root.render(<ExpenseScopePanel
    scope={{ scheduleId: 1, label: "1일차" }} roomId="room" expenses={[]}
    isPending={false} isError={false} canManage busy={false}
    onAdd={() => {}} onEdit={() => {}} onDelete={async () => {}} onRetry={() => {}} onClose={close}
  />));
}
it("dismisses the day/place list sheet by dragging its header", () => {
  mountScope();
  drag(130);
  expect(close).toHaveBeenCalledOnce();
});
it("leaves the desktop scope panel transform untouched", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  mountScope();
  drag(130);
  expect(close).not.toHaveBeenCalled();
  expect(container.querySelector("dialog")!.style.transform).toBe("");
});
