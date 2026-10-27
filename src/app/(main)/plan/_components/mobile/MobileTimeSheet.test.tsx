// @vitest-environment jsdom
import { act, type ComponentProps, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const save = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useRooms", () => ({ useUpdateScheduleItem: () => ({ mutateAsync: save, isPending: false }) }));
// Only replace the external scrolling widget: the sheet, draft logic and time picker remain real.
vi.mock("@ncdai/react-wheel-picker", () => ({
  WheelPickerWrapper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  WheelPicker: ({ options, value, onValueChange }: {
    options: Array<{ value: string | number; label: string }>; value: string | number;
    onValueChange: (value: string | number) => void;
  }) => <select value={value} onChange={e => onValueChange(options.find(o => String(o.value) === e.target.value)!.value)}>
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>,
}));
import { MobileTimeSheet } from "./MobileTimeSheet";
let root: Root;
let container: HTMLDivElement;
let props: ComponentProps<typeof MobileTimeSheet>;
const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent === label || b.getAttribute("aria-label")?.startsWith(label))!;
async function click(label: string) { await act(async () => button(label).click()); }
async function render() { await act(async () => root.render(<MobileTimeSheet {...props} />)); }
async function choose(group: string, value: string) {
  const el = document.querySelector<HTMLSelectElement>(`[aria-label="${group}"] select`)!;
  await act(async () => { el.value = value; el.dispatchEvent(new Event("change", { bubbles: true })); });
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  save.mockReset().mockResolvedValue({});
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  props = { roomId: "room", scheduleId: 10, itemId: 1, placeName: "Place", startTime: null, endTime: null, onClose: vi.fn() };
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
it("opening an unset time leaves both unset and cannot save", async () => {
  await render();
  expect(button("시작 시간").getAttribute("aria-label")).toContain("미설정");
  expect(button("종료 시간").getAttribute("aria-label")).toContain("미설정");
  expect(button("확인").disabled).toBe(true);
  await click("확인"); expect(save).not.toHaveBeenCalled();
});
it("opening an unset end does not invent a duration", async () => {
  props = { ...props, startTime: "14:30" }; await render(); await click("종료 시간");
  expect(button("종료 시간").getAttribute("aria-label")).toContain("미설정");
  expect(button("확인").disabled).toBe(true); expect(save).not.toHaveBeenCalled();
});
it("requires explicit period, hour and minute before saving start only", async () => {
  await render();
  await choose("시", "0"); expect(button("확인").disabled).toBe(true);
  await choose("분", "0"); expect(button("확인").disabled).toBe(true);
  await choose("오전/오후", "AM"); await click("확인");
  expect(save).toHaveBeenCalledExactlyOnceWith({ roomId: "room", scheduleId: 10, itemId: 1, body: { startTime: "00:00" } });
});
it("explicitly sets an overnight end without rewriting start", async () => {
  props = { ...props, startTime: "23:15" }; await render(); await click("종료 시간");
  await choose("오전/오후", "AM"); await choose("시", "1"); await choose("분", "5"); await click("확인");
  expect(save.mock.calls[0][0].body).toEqual({ endTime: "01:05" });
});
it("changes an existing time without altering its unset end", async () => {
  props = { ...props, startTime: "09:07" }; await render(); await choose("분", "8"); await click("확인");
  expect(save.mock.calls[0][0].body).toEqual({ startTime: "09:08" });
});
it.each(["취소", "닫기"])("%s never saves edits or deletions", async label => {
  props = { ...props, startTime: "09:07", endTime: "10:13" }; await render(); await click("시간 지우기"); await click(label);
  expect(save).not.toHaveBeenCalled(); expect(props.onClose).toHaveBeenCalledOnce();
});
it("deletes both times only on confirmation", async () => {
  props = { ...props, startTime: "09:07", endTime: "10:13" }; await render(); await click("시간 지우기");
  expect(save).not.toHaveBeenCalled(); await click("확인");
  expect(save.mock.calls[0][0].body).toEqual({ startTime: null, endTime: null });
});
it("cannot save a start change while the end has only been partially chosen", async () => {
  props = { ...props, startTime: "09:07" }; await render();
  await choose("분", "8"); await click("종료 시간"); await choose("오전/오후", "AM");
  expect(button("확인").disabled).toBe(true);
  await click("확인"); expect(save).not.toHaveBeenCalled();
});
it("a partially cleared existing end is not silently saved as deletion", async () => {
  props = { ...props, startTime: "09:07", endTime: "10:13" }; await render();
  await click("종료 시간"); await choose("분", "");
  expect(button("확인").disabled).toBe(true);
  await click("확인"); expect(save).not.toHaveBeenCalled();
});
