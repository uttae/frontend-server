import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
import { ExpenseSelect } from "./ExpenseSelect";

let renderer: ReactTestRenderer;
const change = vi.fn();
const options = [
  { value: "FOOD", label: "식사" },
  { value: "FLIGHT", label: "항공" },
];
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
});
async function mount(disabled = false) {
  change.mockClear();
  await act(async () => {
    renderer = create(
      <ExpenseSelect
        label="카테고리"
        value=""
        options={options}
        onChange={change}
        disabled={disabled}
      />,
    );
  });
}
const trigger = () => renderer.root.findByProps({ role: "combobox" });
async function key(key: string) {
  const event = {
    key,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    nativeEvent: { isComposing: false },
  };
  await act(async () => trigger().props.onKeyDown(event));
  return event;
}
it("selects custom options by keyboard without submitting the containing form", async () => {
  await mount();
  await key("ArrowDown");
  expect(renderer.root.findAllByProps({ role: "option" })).toHaveLength(2);
  await key("End");
  expect((await key("Enter")).preventDefault).toHaveBeenCalled();
  expect(change).toHaveBeenCalledWith("FLIGHT");
  expect(trigger().props["aria-expanded"]).toBe(false);
});
it("closes on Escape without propagating to the expense dialog", async () => {
  await mount();
  await act(async () => trigger().props.onClick());
  const event = await key("Escape");
  expect(event.preventDefault).toHaveBeenCalled();
  expect(event.stopPropagation).toHaveBeenCalled();
  expect(change).not.toHaveBeenCalled();
  expect(trigger().props["aria-expanded"]).toBe(false);
});
it("does not open or select while disabled", async () => {
  await mount(true);
  await act(async () => trigger().props.onClick());
  await key("ArrowDown");
  expect(trigger().props["aria-expanded"]).toBe(false);
  expect(change).not.toHaveBeenCalled();
});
