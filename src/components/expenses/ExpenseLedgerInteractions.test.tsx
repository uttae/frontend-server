// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ExpenseSelect } from "./ExpenseSelect";
import { ExpenseItemMenu } from "./ExpenseItemMenu";
import { ExpenseCategorySummary } from "./ExpenseCategorySummary";

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
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
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
  trigger.focus();
  await act(async () => trigger.click());
  expect(host.querySelector("dialog[open]")).not.toBeNull();
  await act(async () =>
    host.querySelector<HTMLInputElement>('input[value="FOOD"]')!.click(),
  );
  expect(trigger.textContent).toContain("식비");
  expect(host.querySelector("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
  await act(async () => trigger.click());
  await act(async () =>
    host
      .querySelector("dialog")!
      .dispatchEvent(new Event("cancel", { cancelable: true })),
  );
  expect(host.querySelector("dialog")).toBeNull();
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
  const trigger = host.querySelector<HTMLButtonElement>("[aria-expanded]")!;
  await act(async () => trigger.click());
  const editButton = host.querySelector<HTMLButtonElement>(
    '[aria-label="비용 수정"]',
  )!;
  editButton.focus();
  await act(async () =>
    editButton.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(trigger);
  await act(async () => trigger.click());
  await act(async () =>
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })),
  );
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  await act(async () => trigger.click());
  await act(async () =>
    host.querySelector<HTMLButtonElement>("#outside")!.focus(),
  );
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
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
  expect(breakdown.textContent).toContain("0.30 USD");
  expect(breakdown.textContent).toContain("100 KRW");
  expect(breakdown.textContent).not.toContain("100.30");
});
