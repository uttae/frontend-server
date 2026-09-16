import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
import { ExpenseCurrencyPicker } from "./ExpenseCurrencyPicker";

let renderer: ReactTestRenderer;
const onChange = vi.fn();
const currencies = ["USD", "KRW", "EUR", "JPY"].map((currency) => ({
  currency,
  fractionDigits: 2,
  maximumAmount: "999999.99",
}));
async function mount(disabled = false) {
  onChange.mockClear();
  await act(async () => {
    renderer = create(
      <ExpenseCurrencyPicker
        value="KRW"
        currencies={currencies}
        onChange={onChange}
        disabled={disabled}
      />,
    );
  });
}
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
});
const trigger = () => renderer.root.findByProps({ "aria-haspopup": "dialog" });
const options = () => renderer.root.findAllByProps({ role: "option" });

it("opens search only from the dropdown and searches Korean names or currency codes", async () => {
  await mount();
  expect(renderer.root.findAllByType("input")).toHaveLength(0);
  await act(async () => trigger().props.onClick());
  expect(options()).toHaveLength(4);
  const search = renderer.root.findByType("input");
  await act(async () => search.props.onChange({ target: { value: "달러" } }));
  expect(options()).toHaveLength(1);
  expect(JSON.stringify(renderer.toJSON())).toContain("USD");
  await act(async () => options()[0].props.onClick());
  expect(onChange).toHaveBeenCalledWith("USD");
  expect(renderer.root.findAllByType("input")).toHaveLength(0);
  await act(async () => trigger().props.onClick());
  await act(async () =>
    renderer.root
      .findByType("input")
      .props.onChange({ target: { value: " eur " } }),
  );
  expect(options()).toHaveLength(1);
  await act(async () => options()[0].props.onClick());
  expect(onChange).toHaveBeenLastCalledWith("EUR");
});

it("does not allow unsupported currencies or change the selection on Escape", async () => {
  await mount();
  await act(async () => trigger().props.onClick());
  await act(async () =>
    renderer.root
      .findByType("input")
      .props.onChange({ target: { value: "ZZZ" } }),
  );
  expect(options()).toHaveLength(0);
  expect(JSON.stringify(renderer.toJSON())).toContain("검색 결과가 없어요");
  const preventDefault = vi.fn(),
    stopPropagation = vi.fn();
  await act(async () =>
    renderer.root
      .findByProps({ role: "dialog" })
      .props.onKeyDown({ key: "Escape", preventDefault, stopPropagation }),
  );
  expect(onChange).not.toHaveBeenCalled();
  expect(preventDefault).toHaveBeenCalled();
  expect(stopPropagation).toHaveBeenCalled();
  expect(renderer.root.findAllByType("input")).toHaveLength(0);
});

it("selects search results with the keyboard", async () => {
  await mount();
  await act(async () => trigger().props.onClick());
  await act(async () =>
    renderer.root
      .findByType("input")
      .props.onChange({ target: { value: "엔" } }),
  );
  await act(async () =>
    renderer.root
      .findByType("input")
      .props.onKeyDown({
        key: "Enter",
        preventDefault() {},
        nativeEvent: { isComposing: false },
      }),
  );
  expect(onChange).toHaveBeenCalledWith("JPY");
});
