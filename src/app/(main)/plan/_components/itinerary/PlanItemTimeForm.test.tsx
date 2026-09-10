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
const fields = ["시작 시", "시작 분", "종료 시", "종료 분"];
function input(column: number) {
  const el = container.querySelector<HTMLInputElement>(`input[aria-label="${fields[column]}"]`);
  expect(el, fields[column]).not.toBeNull();
  return el!;
}
function selected(column: number) { return input(column).value; }
async function type(column: number, value: string) {
  const el = input(column);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function key(el: Element, key: string, shiftKey = false) {
  await act(async () => el.dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey, bubbles: true, cancelable: true })));
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
    await type(2, "02");
    await click("적용");
    expect(body()).toEqual({ endTime: "02:00" });
    expect(props.onClose).toHaveBeenCalled();
  });
  it("saves an interval over 1000 minutes without changing wall-clock values", async () => {
    props.startTime = "00:00";
    props.endTime = null;
    await render();
    await type(2, "23");
    await type(3, "59");
    await click("적용");
    expect(body()).toEqual({ endTime: "23:59" });
  });
  it("clears only end, including a zero-length range", async () => {
    props.startTime = "00:00";
    props.endTime = "00:00";
    await render();
    await type(2, "");
    await type(3, "");
    await click("적용");
    expect(body()).toEqual({ endTime: null });
  });
  it.each(["23:00", ""])("closes without saving edits when start is %s", async (startTime) => {
    props.startTime = startTime;
    props.endTime = startTime ? "01:00" : null;
    await render();
    await type(0, "09");
    await click("닫기");
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalledOnce();
  });
  it("sets start only and distinguishes no end from equal end", async () => {
    props.startTime = "";
    props.endTime = null;
    await render();
    await type(0, "00");
    await click("적용");
    expect(body()).toEqual({ startTime: "00:00" });
    await type(2, "00");
    await click("적용");
    expect(body()).toEqual({ startTime: "00:00", endTime: "00:00" });
  });
  it("preserves the edited end during refetch and omits untouched latest start", async () => {
    await render();
    await type(2, "02");
    props = { ...props, startTime: "22:00", endTime: "03:00" };
    await render();
    expect(selected(2)).toBe("02");
    expect(selected(0)).toBe("22");
    await click("적용");
    expect(body()).toEqual({ endTime: "02:00" });
  });
  it("blocks an end draft if remote refresh removes its required start", async () => {
    await render();
    await type(2, "02");
    props = { ...props, startTime: "", endTime: null };
    await render();
    await click("적용");
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });
  it("cancels without sending a PATCH", async () => {
    await render();
    await type(2, "02");
    await click("취소");
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });
});

describe("web time editing", () => {
  it("prefills exact minutes and applies typed values with Enter", async () => {
    props.startTime = "09:07";
    props.endTime = "10:13";
    await render();
    expect(fields.map((_, i) => selected(i))).toEqual(["09", "07", "10", "13"]);
    expect(document.activeElement).toBe(input(0));
    await type(0, "8");
    expect(selected(0)).toBe("8");
    await type(1, "5");
    await key(input(1), "Enter");
    expect(body()).toEqual({ startTime: "08:05" });
  });
  it.each(["24", "-1", "abc", "", "100"])("shows invalid hour %s without saving", async (value) => {
    await render();
    await type(0, value);
    expect(input(0).getAttribute("aria-invalid")).toBe("true");
    expect(container.querySelector('[role="alert"]')?.textContent).toBeTruthy();
    await key(input(0), "Enter");
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    await type(0, "22");
    expect(input(0).getAttribute("aria-invalid")).toBe("false");
  });
  it("rejects invalid minutes and does not auto-save on blur", async () => {
    await render();
    await type(1, "60");
    await click("적용");
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    await type(1, "59");
    input(1).blur();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    await click("적용");
    expect(body()).toEqual({ startTime: "23:59" });
  });
  it("traps Tab at both ends and restores opener focus after Escape", async () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    props.onClose = vi.fn(() => root.render(null));
    await render();
    const focusable = [...container.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)')];
    focusable[0].focus();
    await key(focusable[0], "Tab", true);
    expect(document.activeElement).toBe(focusable.at(-1));
    await key(focusable.at(-1)!, "Tab");
    expect(document.activeElement).toBe(focusable[0]);
    await key(input(0), "Escape");
    expect(props.onClose).toHaveBeenCalledOnce();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
  it("keeps the draft open on server failure", async () => {
    mocks.mutateAsync.mockRejectedValue(new Error("synthetic failure"));
    await render();
    await type(0, "22");
    await click("적용");
    expect(props.onClose).not.toHaveBeenCalled();
    expect(selected(0)).toBe("22");
    expect(mocks.error).toHaveBeenCalledWith("synthetic failure");
  });
});
