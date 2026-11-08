// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ExpenseSelect } from "./ExpenseSelect";
import { ExpenseItemMenu } from "./ExpenseItemMenu";
import { ExpenseCategorySummary } from "./ExpenseCategorySummary";

// 카테고리 바텀시트는 화면 폭이 아니라 모바일 기기일 때만 열린다
vi.mock("@/contexts/MobileViewContext", () => ({
  useMobileView: () => ({ isMobileDevice: true }),
}));
vi.mock("./ExpenseProvider", () => ({
  useExpenseContext: () => ({
    list: {
      isSuccess: true,
      data: [
        { category: "FOOD", currency: "USD", totalAmount: "0.10" },
        { category: "FOOD", currency: "USD", totalAmount: "0.20" },
        { category: "FOOD", currency: "KRW", totalAmount: "100" },
      ],
    },
  }),
}));
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
// Base UI는 열고 닫은 뒤 포커스·언마운트를 다음 틱(프레임)에 한다
const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
const sheet = () => document.querySelector<HTMLElement>('[role="dialog"]');
// 딤·바깥 누르기: Base UI는 pointerdown·mousedown에서 시작해 click으로 끝난 누르기만 바깥 누르기로 본다
async function pressOutside(target: HTMLElement) {
  await act(async () => {
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0 }));
    }
  });
}
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it("chooses a mobile category and restores its trigger, while cancel leaves selection intact", async () => {
  function Filter() {
    const [value, setValue] = useState("ALL");
    return (
      <ExpenseSelect
        label="카테고리 필터"
        value={value}
        onChange={setValue}
        mobileSheet
        options={[
          { value: "ALL", label: "전체 카테고리" },
          { value: "FOOD", label: "식비" },
        ]}
      />
    );
  }
  await act(async () => root.render(<Filter />));
  const trigger = host.querySelector<HTMLButtonElement>('[role="combobox"]')!;
  const open = async () => {
    trigger.focus();
    await act(async () => trigger.click());
    await flush();
    expect(sheet()?.hasAttribute("data-open")).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  };
  const expectClosedOnTrigger = async () => {
    await flush();
    expect(sheet()).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  };
  await open();
  // 첫 포커스는 Base UI 기본대로 시트 안으로 간다
  expect(sheet()!.contains(document.activeElement)).toBe(true);
  expect(sheet()!.querySelector("h2")?.textContent).toBe("카테고리");
  const food = [...sheet()!.querySelectorAll<HTMLElement>('[role="radio"]')]
    .find((radio) => radio.closest("label")?.textContent?.includes("식비"))!;
  await act(async () => food.click());
  expect(trigger.textContent).toContain("식비");
  await expectClosedOnTrigger();
  await open();
  await act(async () =>
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
  );
  await expectClosedOnTrigger();
  expect(trigger.textContent).toContain("식비");
  await open();
  await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="카테고리 닫기"]')!.click());
  await expectClosedOnTrigger();
  expect(trigger.textContent).toContain("식비");
  await open();
  await pressOutside(document.querySelector<HTMLElement>('[data-slot="drawer-overlay"]')!);
  await expectClosedOnTrigger();
  expect(trigger.textContent).toContain("식비");
});

it("closes the item disclosure on Escape, outside pointer and focus departure without acting", async () => {
  const edit = vi.fn(),
    remove = vi.fn();
  await act(async () =>
    root.render(
      <>
        <ExpenseItemMenu
          label="항공"
          busy={false}
          onEdit={edit}
          onDelete={remove}
        />
        <button id="outside">다른 버튼</button>
      </>,
    ),
  );
  const trigger = host.querySelector<HTMLButtonElement>('[aria-label="항공 비용 더보기"]')!;
  const open = async () => {
    await act(async () => trigger.click());
    await flush();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  };
  await open();
  // 메뉴는 body로 포털된다. 항목은 Base UI Menu.Item(role="menuitem")
  const editItem = document.querySelector<HTMLElement>('[role="menuitem"][aria-label="비용 수정"]')!;
  expect(editItem).not.toBeNull();
  editItem.focus();
  await act(async () =>
    editItem.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  await flush();
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(trigger);
  await open();
  await pressOutside(document.body);
  await flush();
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  await open();
  // Tab으로 마지막 항목을 지나면 포커스가 메뉴 포털 끝의 포커스 가드로 간다. jsdom은 Tab 이동이 없어 그 가드로 직접 옮긴다
  const guards = document.querySelectorAll<HTMLElement>("[data-base-ui-portal] [data-base-ui-focus-guard]");
  await act(async () => guards[guards.length - 1].focus());
  await flush();
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(host.querySelector("#outside"));
  expect(edit).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});

it("expands the category breakdown without adding different currencies together", async () => {
  await act(async () => root.render(<ExpenseCategorySummary />));
  const trigger = host.querySelector<HTMLButtonElement>("button")!;
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  await act(async () => trigger.click());
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  const breakdown = document.getElementById(
    trigger.getAttribute("aria-controls")!,
  )!;
  expect(breakdown.textContent).toContain("USD 0.30");
  expect(breakdown.textContent).toContain("KRW 100");
  expect(breakdown.textContent).not.toContain("100.30");
});
