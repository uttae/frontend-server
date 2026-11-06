// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExpenseDialog } from "./ExpenseDialog";
import { ExpenseEditor } from "./ExpenseEditor";
import { ExpenseScopePanel } from "./ExpenseScopePanel";

// 딤·Esc·X로 닫히는지를 실제 Base UI 대화상자(PC)·시트(모바일 기기)로 본다. 끄는 거리·속도 기준은 Base UI Drawer가 맡아 여기서 보지 않는다
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
  // Base UI는 열림·닫힘을 microtask·requestAnimationFrame·타이머로 반영한다
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
}
// 대화상자는 document.body로 포털된다. 사용자가 누르는 딤은 PC에서는 딤 요소, 시트에서는 딤 위를 덮는 시트 바깥 빈 곳이다
const surface = () => document.querySelector<HTMLElement>('[role="dialog"]')!;
const dim = () => document.querySelector<HTMLElement>(
  state.mobile ? '[data-slot="drawer-viewport"]' : '[data-slot="dialog-overlay"]',
)!;
const buttonNamed = (label: string) => document.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
function pointer(target: Element, type: string) {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, detail: type === "click" ? 1 : 0 }));
}
/** 마우스 왼쪽 버튼으로 눌렀다 뗀다. 누른 곳과 뗀 곳이 다르면 click은 둘의 공통 조상이 아니라 뗀 곳에서 받는다고 단순화한다 */
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
      // 그 뒤 딤을 제대로 누르면 닫힌다
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
      // 막힌 것은 딤만이다
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
      // 저장·삭제가 끝나면 다시 닫힌다
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
  // 읽기 전용이라 PC·시트 모두 딤으로 닫는다(옛 ExpenseDialog와 같음)
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
