// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ExpenseCurrencyPicker } from "./ExpenseCurrencyPicker";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement;
let root: Root;
const onChange = vi.fn();
const currencies = ["USD", "KRW", "EUR", "JPY"].map((currency) => ({
  currency,
  fractionDigits: 2,
  maximumAmount: "999999.99",
}));
beforeEach(() => {
  onChange.mockClear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
async function mount({ value = "KRW", list = currencies, disabled = false } = {}) {
  await act(async () =>
    root.render(<ExpenseCurrencyPicker value={value} currencies={list} onChange={onChange} disabled={disabled} />),
  );
}
// Base UI는 열고 닫을 때 microtask·timeout으로 포커스·목록을 옮긴다
const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
const trigger = () => document.querySelector<HTMLElement>('[role="combobox"][aria-haspopup="dialog"]')!;
const search = () => document.querySelector<HTMLInputElement>('input[aria-label="통화 검색"]');
const options = () => [...document.querySelectorAll<HTMLElement>('[role="option"]')];
async function open() {
  await act(async () => trigger().click());
  await flush();
}
// 사용자가 친 글자로 보이도록 inputType을 준다. Base UI는 inputType이 없는 입력(자동 완성)에는 첫 결과를 강조하지 않는다
async function type(value: string) {
  const input = search()!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  });
  await flush();
}
async function key(target: Element, key: string) {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
  await flush();
}

it("opens search only from the trigger and searches Korean names or currency codes", async () => {
  await mount();
  expect(trigger().textContent).toContain("KRW");
  expect(search()).toBeNull();
  await open();
  expect(trigger().getAttribute("aria-expanded")).toBe("true");
  expect(document.activeElement).toBe(search());
  expect(options()).toHaveLength(4);
  await type("달러");
  expect(options().map((option) => option.textContent)).toEqual(["미국 달러USD"]);
  await act(async () => options()[0].click());
  await flush();
  expect(onChange).toHaveBeenCalledWith("USD");
  expect(trigger().getAttribute("aria-expanded")).toBe("false");
  await open();
  await type(" eur ");
  expect(options()).toHaveLength(1);
  await act(async () => options()[0].click());
  expect(onChange).toHaveBeenLastCalledWith("EUR");
});

it("does not allow unsupported currencies or change the selection on Escape", async () => {
  await mount();
  await open();
  await type("ZZZ");
  expect(options()).toHaveLength(0);
  expect(document.querySelector('[role="dialog"]')!.textContent).toContain("검색 결과가 없어요.");
  await key(search()!, "Escape");
  expect(onChange).not.toHaveBeenCalled();
  expect(trigger().getAttribute("aria-expanded")).toBe("false");
  expect(trigger().textContent).toContain("KRW");
});

it("selects the first search result with Enter", async () => {
  await mount();
  await open();
  await type("엔");
  expect(options().map((option) => option.textContent)).toEqual(["일본 엔화JPY"]);
  await key(search()!, "Enter");
  expect(onChange).toHaveBeenCalledWith("JPY");
  expect(trigger().getAttribute("aria-expanded")).toBe("false");
});

it("does not open while disabled", async () => {
  await mount({ disabled: true });
  await open();
  expect(trigger().getAttribute("aria-expanded")).toBe("false");
  expect(search()).toBeNull();
});

it("shows the form value on the trigger while the currency list is missing", async () => {
  await mount({ list: [] });
  expect(trigger().textContent).toContain("KRW");
  await mount({ value: "", list: [] });
  expect(trigger().textContent).toBe("통화 선택");
});

