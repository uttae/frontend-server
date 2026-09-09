// @vitest-environment jsdom
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/hooks/useRooms", () => ({
  useUpdateScheduleItem: () => ({
    mutateAsync: mocks.mutateAsync,
    isPending: false,
  }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));
import { PlanItemTimeEditor } from "./PlanItemTimeForm";

let root: Root;
let container: HTMLDivElement;
let props: ComponentProps<typeof PlanItemTimeEditor>;
async function render() {
  await act(async () => root.render(<PlanItemTimeEditor {...props} />));
}
async function click(label: string) {
  const button = [...container.querySelectorAll("button")].find(
    (el) => el.getAttribute("aria-label") === label || el.textContent === label,
  );
  expect(button, label).toBeDefined();
  await act(async () => button!.click());
}
async function select(column: number, value: string) {
  const button = [
    ...container
      .querySelectorAll('[role="listbox"]')
      [column]!.querySelectorAll<HTMLButtonElement>("button"),
  ].find((el) => el.textContent === value)!;
  await act(async () => button.click());
}
function selected(column: number) {
  return container
    .querySelectorAll('[role="listbox"]')
    [column]?.querySelector('[aria-selected="true"]')?.textContent;
}
function body() {
  return mocks.mutateAsync.mock.calls.at(-1)?.[0].body;
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  HTMLElement.prototype.scrollTo = vi.fn();
  vi.clearAllMocks();
  mocks.mutateAsync.mockResolvedValue({});
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  props = {
    roomId: "room",
    scheduleId: 10,
    itemId: 1,
    startTime: "23:00",
    endTime: "01:00",
    onClose: vi.fn(),
  };
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("schedule time editor", () => {
  it("reenters with the exact saved overnight end and sends only an edited end", async () => {
    await render();
    expect(selected(2)).toBe("01");
    await select(2, "02");
    await click("저장");
    expect(body()).toEqual({ endTime: "02:00" });
    expect(props.onClose).toHaveBeenCalled();
  });
  it("saves an interval over 1000 minutes without changing wall-clock values", async () => {
    props.startTime = "00:00";
    props.endTime = null;
    await render();
    await select(2, "23");
    await select(3, "59");
    await click("저장");
    expect(body()).toEqual({ endTime: "23:59" });
  });
  it("clears only end, including a zero-length range", async () => {
    props.startTime = "00:00";
    props.endTime = "00:00";
    await render();
    await click("종료 시각 지우기");
    await click("저장");
    expect(body()).toEqual({ endTime: null });
  });
  it("clears both fields when removing the start", async () => {
    await render();
    await click("시작 시각 지우기");
    await click("저장");
    expect(body()).toEqual({ startTime: null, endTime: null });
  });
  it("sets start only and distinguishes no end from equal end", async () => {
    props.startTime = "";
    props.endTime = null;
    await render();
    await select(0, "00");
    await click("저장");
    expect(body()).toEqual({ startTime: "00:00" });
    await select(2, "00");
    await click("저장");
    expect(body()).toEqual({ startTime: "00:00", endTime: "00:00" });
  });
  it("preserves the edited end during refetch and omits untouched latest start", async () => {
    await render();
    await select(2, "02");
    props = { ...props, startTime: "22:00", endTime: "03:00" };
    await render();
    expect(selected(2)).toBe("02");
    expect(selected(0)).toBe("22");
    await click("저장");
    expect(body()).toEqual({ endTime: "02:00" });
  });
  it("blocks an end draft if remote refresh removes its required start", async () => {
    await render();
    await select(2, "02");
    props = { ...props, startTime: "", endTime: null };
    await render();
    await click("저장");
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });
  it("cancels without sending a PATCH", async () => {
    await render();
    await select(2, "02");
    await click("취소");
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });
});
