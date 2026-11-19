// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExpenseDialog } from "./ExpenseDialog";
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
  state.mobile = true; state.busy = false; close.mockReset();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
});

async function settle() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
}
const surface = () => document.querySelector<HTMLElement>('[role="dialog"]')!;
const dim = () => document.querySelector<HTMLElement>(
  state.mobile ? '[data-slot="drawer-viewport"]' : '[data-slot="dialog-overlay"]',
)!;
const buttonNamed = (label: string) => document.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
function pointer(target: Element, type: string) {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, detail: type === "click" ? 1 : 0 }));
}
async function press(start: Element, end: Element = start) {
  await act(async () => {
    pointer(start, "pointerdown");
    pointer(start, "mousedown");
    pointer(end, "pointerup");
    pointer(end, "mouseup");
    pointer(end, "click");
  });
  await settle();
}
async function pressEscape() {
  await act(async () => {
    (document.activeElement ?? document.body).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
  });
  await settle();
}

const kinds = {
  editor: {
    closeLabel: "닫기",
    render: () => <ExpenseEditor initial={{}} onClose={close} />,
  },
  list: {
    closeLabel: "비용 목록 닫기",
    render: () => (
      <ExpenseScopePanel scope={{ scheduleId: 2, label: "1일차" }} roomId="r" expenses={[]}
        isPending={false} isError={false} canManage busy={state.busy} onAdd={() => {}}
        onEdit={() => {}} onDelete={async () => {}} onRetry={() => {}} onClose={close} />
    ),
  },
} as const;

for (const [kind, { closeLabel, render }] of Object.entries(kinds)) {
  describe(`${kind} dismissal`, () => {
    async function mount() {
      await act(async () => root.render(render()));
      await settle();
      expect(surface()).not.toBeNull();
    }
    it("closes the mobile sheet once when its dim is pressed", async () => {
      await mount();
      expect(document.querySelector('[data-slot="drawer-content"]')).not.toBeNull();
      await press(dim());
      expect(close).toHaveBeenCalledOnce();
    });
    it("keeps the mobile sheet open for presses inside it, including a press dragged out onto the dim", async () => {
      await mount();
      const title = surface().querySelector("h2")!;
      await press(title);
      await press(title, dim());
      expect(close).not.toHaveBeenCalled();
      await press(dim());
      expect(close).toHaveBeenCalledOnce();
    });
    it("keeps the desktop dialog open when its dim is pressed", async () => {
      state.mobile = false;
      await mount();
      expect(document.querySelector('[data-slot="dialog-content"]')).not.toBeNull();
      await press(dim());
      expect(close).not.toHaveBeenCalled();
      expect(surface()).not.toBeNull();
      await pressEscape();
      expect(close).toHaveBeenCalledOnce();
    });
    it.each([true, false])("closes by Escape and the close button when idle (mobile %s)", async (mobile) => {
      state.mobile = mobile;
      await mount();
      await pressEscape();
      expect(close).toHaveBeenCalledOnce();
      await act(async () => buttonNamed(closeLabel).click());
      await settle();
      expect(close).toHaveBeenCalledTimes(2);
    });
    it.each([true, false])("never closes by dim, Escape, close or cancel while busy (mobile %s)", async (mobile) => {
      state.mobile = mobile;
      state.busy = true;
      await mount();
      await press(dim());
      await pressEscape();
      const closeButton = buttonNamed(closeLabel);
      expect(closeButton.disabled).toBe(true);
      await act(async () => closeButton.click());
      const cancel = [...surface().querySelectorAll("button")].find((button) => button.textContent === "취소");
      if (kind === "editor") {
        expect(cancel!.disabled).toBe(true);
        await act(async () => cancel!.click());
      }
      await settle();
      expect(close).not.toHaveBeenCalled();
      expect(surface()).not.toBeNull();
      state.busy = false;
      await act(async () => root.render(render()));
      await pressEscape();
      expect(close).toHaveBeenCalledOnce();
    });
  });
}

describe("settlement dialog dismissal", () => {
  async function mount() {
    await act(async () => root.render(
      <ExpenseDialog title="정산 요약" onClose={close}><p>정산 내용</p></ExpenseDialog>,
    ));
    await settle();
  }
  it.each([true, false])("closes by dim, Escape and the close button (mobile %s)", async (mobile) => {
    state.mobile = mobile;
    await mount();
    await press(surface().querySelector("p")!);
    expect(close).not.toHaveBeenCalled();
    await press(dim());
    expect(close).toHaveBeenCalledTimes(1);
    await pressEscape();
    expect(close).toHaveBeenCalledTimes(2);
    await act(async () => buttonNamed("정산 요약 닫기").click());
    await settle();
    expect(close).toHaveBeenCalledTimes(3);
  });
});
