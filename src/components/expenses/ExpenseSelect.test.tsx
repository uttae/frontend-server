// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ExpenseSelect } from "./ExpenseSelect";

const state = vi.hoisted(() => ({ mobile: false }));
vi.mock("@/contexts/MobileViewContext", () => ({ useMobileView: () => ({ isMobileDevice: state.mobile }) }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement;
let root: Root;
const change = vi.fn();
const options = [
  { value: "FOOD", label: "식사" },
  { value: "FLIGHT", label: "항공" },
];
beforeEach(() => {
  state.mobile = false;
  change.mockClear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
async function render(node: ReactNode) {
  await act(async () => root.render(node));
}
async function mount(props: { disabled?: boolean; mobileSheet?: boolean } = {}) {
  await render(<ExpenseSelect label="카테고리" value="" options={options} onChange={change} {...props} />);
}
const trigger = () => document.querySelector<HTMLElement>('[role="combobox"]')!;
const optionNodes = () => [...document.querySelectorAll<HTMLElement>('[role="option"]')];
// Base UI는 열고 닫을 때 microtask·timeout으로 포커스·목록을 옮긴다
const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
async function key(target: Element, key: string) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  await act(async () => { target.dispatchEvent(event); });
  await flush();
  return event;
}

it("selects options by keyboard without submitting the containing form", async () => {
  const submit = vi.fn();
  await render(
    <form onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <ExpenseSelect label="카테고리" value="" options={options} onChange={change} />
    </form>,
  );
  expect(trigger().textContent).toBe("선택");
  await act(async () => trigger().focus());
  await key(trigger(), "ArrowDown");
  expect(trigger().getAttribute("aria-expanded")).toBe("true");
  expect(optionNodes().map((option) => option.textContent)).toEqual(["식사", "항공"]);
  await key(document.activeElement!, "End");
  expect(document.activeElement?.textContent).toBe("항공");
  await key(document.activeElement!, "Enter");
  expect(change).toHaveBeenCalledWith("FLIGHT");
  expect(submit).not.toHaveBeenCalled();
  expect(trigger().getAttribute("aria-expanded")).toBe("false");
});

it("closes on Escape without changing the value and returns focus to the trigger", async () => {
  await mount();
  await act(async () => trigger().click());
  await flush();
  expect(trigger().getAttribute("aria-expanded")).toBe("true");
  await key(document.activeElement!, "Escape");
  expect(change).not.toHaveBeenCalled();
  expect(trigger().getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(trigger());
});

it("does not open or select while disabled", async () => {
  await mount({ disabled: true });
  await act(async () => trigger().click());
  await act(async () => trigger().focus());
  await key(trigger(), "ArrowDown");
  expect(trigger().getAttribute("aria-expanded")).toBe("false");
  expect(change).not.toHaveBeenCalled();
});

it("shows the label of an empty-value option instead of the placeholder", async () => {
  await render(
    <ExpenseSelect
      label="연결 장소 (선택)"
      value=""
      options={[{ value: "", label: "장소 연결 없음" }, { value: "100", label: "경복궁" }]}
      onChange={change}
    />,
  );
  expect(trigger().textContent).toBe("장소 연결 없음");
  await act(async () => trigger().click());
  await flush();
  await act(async () => optionNodes().find((option) => option.textContent === "경복궁")!.click());
  expect(change).toHaveBeenCalledWith("100");
});

it("marks the trigger invalid only while aria-invalid is set", async () => {
  await render(<ExpenseSelect label="카테고리" value="" options={options} onChange={change} aria-invalid />);
  expect(trigger().getAttribute("aria-invalid")).toBe("true");
  await render(<ExpenseSelect label="카테고리" value="" options={options} onChange={change} aria-invalid={false} />);
  expect(trigger().hasAttribute("aria-invalid")).toBe(false);
});

it("picks from a bottom sheet radio list on mobile devices when mobileSheet is set", async () => {
  state.mobile = true;
  await mount({ mobileSheet: true });
  expect(trigger().getAttribute("aria-haspopup")).toBe("dialog");
  await act(async () => trigger().click());
  await flush();
  const sheet = document.querySelector<HTMLElement>('[role="dialog"]')!;
  expect(sheet.textContent).toContain("카테고리");
  const radios = [...sheet.querySelectorAll<HTMLElement>('[role="radio"]')];
  expect(radios).toHaveLength(2);
  await act(async () => radios[1].click());
  await flush();
  expect(change).toHaveBeenCalledWith("FLIGHT");
  expect(trigger().getAttribute("aria-expanded")).toBe("false");
});
