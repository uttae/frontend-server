// @vitest-environment jsdom
import { act, type SyntheticEvent } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { Dialog, DialogContent, DialogTitle } from "./dialog";
import { AlertDialog, AlertDialogContent, AlertDialogTitle } from "./alert-dialog";

let host: HTMLDivElement;
let root: Root;
const outer = vi.fn();
const close = vi.fn();
const contain = (event: SyntheticEvent) => event.stopPropagation();
const boundary = { onClick: contain, onMouseDown: contain, onPointerDown: contain, onTouchStart: contain };
const hostEvents = { onClick: outer, onMouseDown: outer, onPointerDown: outer, onTouchStart: outer };

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

// Without backdrop forwarding, portal background events reach the owning card.
it.each(["dialog", "alert-dialog"])("contains %s backdrop events without blocking dismissal", async kind => {
  await act(async () => root.render(
    <div {...hostEvents}>
      {kind === "dialog" ? (
        <Dialog open onOpenChange={open => { if (!open) close(); }}>
          <DialogContent {...boundary} backdropProps={boundary}>
            <DialogTitle>선택</DialogTitle>
            <p>내용</p>
          </DialogContent>
        </Dialog>
      ) : (
        <AlertDialog open onOpenChange={open => { if (!open) close(); }}>
          <AlertDialogContent {...boundary} backdropProps={boundary} backdropCloseLabel="배경 닫기">
            <AlertDialogTitle>선택</AlertDialogTitle>
            <p>내용</p>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>,
  ));
  const backdrop = document.querySelector(`[data-slot="${kind}-overlay"]`)!;
  const target = backdrop.querySelector("button") ?? backdrop;
  for (const type of ["mousedown", "pointerdown", "touchstart", "click"]) {
    await act(async () => target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true })));
  }
  expect(outer).not.toHaveBeenCalled();
  expect(close).toHaveBeenCalled();
  close.mockClear();
  await act(async () => document.querySelector("p")!.click());
  expect(outer).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
  await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(close).toHaveBeenCalledOnce();
});
