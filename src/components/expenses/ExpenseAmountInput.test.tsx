import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
import { ExpenseAmountInput } from "./ExpenseAmountInput";

let renderer: ReactTestRenderer;
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
});
it.each([
  ["1234", 2, "1234.00"],
  ["1234.5", 2, "1234.50"],
  ["1234.567", 2, "1234.56"],
  ["1.999", 2, "1.99"],
  ["999999999999999.999", 2, "999999999999999.99"],
  ["12.", 3, "12.000"],
  [".5", 2, "0.50"],
  ["12.99", 0, "12"],
])(
  "normalizes %s to %s decimal places only on blur",
  async (value, fractionDigits, expected) => {
    const change = vi.fn();
    await act(async () => {
      renderer = create(
        <ExpenseAmountInput
          value={value}
          fractionDigits={fractionDigits}
          onChange={change}
          placeholder="0"
        />,
      );
    });
    expect(change).not.toHaveBeenCalled();
    await act(async () => renderer.root.findByType("input").props.onBlur());
    expect(change).toHaveBeenCalledWith(expected);
  },
);
it.each(["", ".", "abc", "12..34", "-1.23", "1e3", " 12", "12.00"])(
  "does not rewrite empty, malformed, or already normalized input %s",
  async (value) => {
    const change = vi.fn();
    await act(async () => {
      renderer = create(
        <ExpenseAmountInput
          value={value}
          fractionDigits={2}
          onChange={change}
          placeholder="0"
        />,
      );
    });
    await act(async () => renderer.root.findByType("input").props.onBlur());
    expect(change).not.toHaveBeenCalled();
  },
);
it("keeps input unchanged while currency precision is unavailable", async () => {
  const change = vi.fn();
  await act(async () => {
    renderer = create(
      <ExpenseAmountInput value="12.345" onChange={change} placeholder="0" />,
    );
  });
  await act(async () => renderer.root.findByType("input").props.onBlur());
  expect(change).not.toHaveBeenCalled();
});
