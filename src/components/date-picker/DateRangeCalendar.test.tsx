// @vitest-environment jsdom
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { DateRangeCalendar } from "./DateRangeCalendar";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement;
let root: Root;
const handlers = { onSelect: vi.fn(), onCancel: vi.fn(), onConfirm: vi.fn() };

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.clearAllMocks();
});

async function render(props: Pick<ComponentProps<typeof DateRangeCalendar>, "value" | "min">) {
  await act(async () => root.render(<DateRangeCalendar {...props} {...handlers} />));
}
const visibleMonths = () => [...host.querySelectorAll('[role="grid"]')].map((grid) => grid.getAttribute("aria-label"));
const buttons = (name: string) =>
  [...host.querySelectorAll<HTMLButtonElement>("button")].filter(
    (button) => button.getAttribute("aria-label") === name || button.textContent === name,
  );
const day = (ymd: string) => host.querySelector<HTMLButtonElement>(`button[data-ymd="${ymd}"]`)!;
const focusedDay = () => document.activeElement?.getAttribute("data-ymd");
async function press(key: string) {
  await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })));
}

it("shows the start month beside the next month and moves the pair one month at a time", async () => {
  await render({ value: { start: "2099-07-10", end: "" }, min: "2099-07-01" });
  expect(visibleMonths()).toEqual(["2099년 7월", "2099년 8월"]);
  expect(buttons("이전 달").every((button) => button.disabled)).toBe(true);

  await act(async () => buttons("다음 달")[1]!.click());
  expect(visibleMonths()).toEqual(["2099년 8월", "2099년 9월"]);
  expect(buttons("이전 달").some((button) => button.disabled)).toBe(false);

  await act(async () => buttons("이전 달")[0]!.click());
  expect(visibleMonths()).toEqual(["2099년 7월", "2099년 8월"]);
});

it("starts on the selected day and moves the pair only when the arrow keys leave it", async () => {
  await render({ value: { start: "2099-07-30", end: "" }, min: "2099-07-01" });
  expect(focusedDay()).toBe("2099-07-30");

  await press("ArrowDown");
  expect(focusedDay()).toBe("2099-08-06");
  expect(visibleMonths()).toEqual(["2099년 7월", "2099년 8월"]);

  for (let step = 0; step < 4; step++) await press("ArrowDown");
  expect(focusedDay()).toBe("2099-09-03");
  expect(visibleMonths()).toEqual(["2099년 8월", "2099년 9월"]);
  expect(host.querySelectorAll('button[data-ymd][tabindex="0"]')).toHaveLength(1);
});

it("does not move before the minimum month", async () => {
  await render({ value: { start: "2099-07-02", end: "" }, min: "2099-07-01" });
  await press("ArrowUp");
  expect(focusedDay()).toBe("2099-07-02");
  expect(visibleMonths()).toEqual(["2099년 7월", "2099년 8월"]);
});

it("reports picked days, confirms with 확인, and cancels with 취소 or the close button", async () => {
  await render({ value: { start: "", end: "" }, min: "2099-07-01" });
  expect(buttons("확인")[0]!.disabled).toBe(true);

  await render({ value: { start: "2099-07-10", end: "2099-08-02" }, min: "2099-07-01" });
  await act(async () => day("2099-08-05").click());
  expect(handlers.onSelect).toHaveBeenCalledWith("2099-08-05");
  expect(host.textContent).toContain("07.10 금 - 08.02 일 (23박)");

  await act(async () => buttons("확인")[0]!.click());
  expect(handlers.onConfirm).toHaveBeenCalledTimes(1);
  await act(async () => buttons("취소")[0]!.click());
  await act(async () => buttons("닫기")[0]!.click());
  expect(handlers.onCancel).toHaveBeenCalledTimes(2);
});
