// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExpenseEditor } from "./ExpenseEditor";
import { ExpenseScopePanel } from "./ExpenseScopePanel";

const state = vi.hoisted(() => ({ mobile: true, busy: false }));
vi.mock("@/contexts/MobileViewContext", () => ({
  useMobileView: () => ({ isMobileDevice: state.mobile }),
}));
vi.mock("./ExpenseProvider", () => ({
  useExpenseContext: () => ({
    roomId: "r", currentUserId: 1, members: [], memberStatus: "success",
    canManage: true, schedules: [], schedulesReady: true, busy: state.busy,
    currencies: { data: [{ currency: "KRW", fractionDigits: 0, maximumAmount: "999999999999999" }], isSuccess: true },
    list: { data: [], isSuccess: true }, save: vi.fn(), readLatest: vi.fn(),
  }),
}));
vi.mock("@/hooks/useRooms", () => ({
  useSchedulePlanPlaces: () => ({ data: [], isSuccess: true, isPending: false, isError: false }),
}));

let root: Root;
let host: HTMLDivElement;
const close = vi.fn();
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  state.mobile = true; state.busy = false; close.mockReset();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
});
async function pointer(target: Element, type: string, button = 0) {
  await act(async () => target.dispatchEvent(new MouseEvent(type, { bubbles: true, button })));
}

for (const kind of ["editor", "list"] as const) {
  describe(`${kind} backdrop dismissal`, () => {
    async function mount() {
      await act(async () => root.render(kind === "editor"
        ? <ExpenseEditor initial={{}} onClose={close} />
        : <ExpenseScopePanel scope={{ scheduleId: 2, label: "1일차" }} roomId="r" expenses={[]}
            isPending={false} isError={false} canManage busy={state.busy} onAdd={() => {}}
            onEdit={() => {}} onDelete={async () => {}} onRetry={() => {}} onClose={close} />));
      return host.querySelector("dialog")!;
    }
    it("dismisses once when a mobile backdrop press is released", async () => {
      const dialog = await mount();
      await pointer(dialog, "pointerdown");
      expect(close).not.toHaveBeenCalled();
      await pointer(dialog, "pointerup");
      expect(close).toHaveBeenCalledOnce();
      await pointer(dialog, "pointerup");
      expect(close).toHaveBeenCalledOnce();
    });
    it("keeps content interactions and gestures ending outside open", async () => {
      const dialog = await mount();
      const content = host.querySelector("h2")!;
      await pointer(content, "pointerdown");
      await pointer(dialog, "pointerup");
      await pointer(dialog, "pointerdown");
      await pointer(content, "pointerup");
      await pointer(content, "pointerdown");
      await pointer(content, "pointerup");
      expect(close).not.toHaveBeenCalled();
    });
    it("discards a cancelled backdrop gesture", async () => {
      const dialog = await mount();
      await pointer(dialog, "pointerdown");
      await pointer(dialog, "pointercancel");
      await pointer(dialog, "pointerup");
      expect(close).not.toHaveBeenCalled();
    });
    it("ignores secondary-button backdrop presses", async () => {
      const dialog = await mount();
      await pointer(dialog, "pointerdown", 2);
      await pointer(dialog, "pointerup", 2);
      expect(close).not.toHaveBeenCalled();
    });
    it("keeps desktop backdrop presses open", async () => {
      state.mobile = false;
      const dialog = await mount();
      await pointer(dialog, "pointerdown"); await pointer(dialog, "pointerup");
      expect(close).not.toHaveBeenCalled();
    });
    it("blocks backdrop and Escape dismissal while busy", async () => {
      state.busy = true;
      const dialog = await mount();
      await pointer(dialog, "pointerdown"); await pointer(dialog, "pointerup");
      const cancel = new Event("cancel", { cancelable: true });
      await act(async () => dialog.dispatchEvent(cancel));
      expect(cancel.defaultPrevented).toBe(true);
      expect(close).not.toHaveBeenCalled();
    });
    it("preserves Escape dismissal without a pointer gesture", async () => {
      const dialog = await mount();
      const cancel = new Event("cancel", { cancelable: true });
      await act(async () => dialog.dispatchEvent(cancel));
      expect(cancel.defaultPrevented).toBe(true);
      expect(close).toHaveBeenCalledOnce();
    });
  });
}
