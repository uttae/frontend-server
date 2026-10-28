// @vitest-environment jsdom
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const save = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useRooms", () => ({ useUpdateScheduleItem: () => ({ mutateAsync: save, isPending: false }) }));
import { MobileTimeSheet } from "./MobileTimeSheet";
let root: Root;
let container: HTMLDivElement;
let props: ComponentProps<typeof MobileTimeSheet>;
const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent === label || b.getAttribute("aria-label")?.startsWith(label))!;
async function click(label: string) { await act(async () => button(label).click()); }
async function render() { await act(async () => root.render(<MobileTimeSheet {...props} />)); }
async function choose(group: string, value: string) {
  const el = document.querySelector<HTMLButtonElement>(`[role="listbox"][aria-label="${group}"] [data-value="${value}"]`);
  expect(el).not.toBeNull(); expect(el!.disabled).toBe(false);
  await act(async () => el!.click());
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
  await render(); await click("시작 시간");
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
  props = { ...props, startTime: "09:07", endTime: "10:13" }; await render(); await click("초기화"); await click(label);
  expect(save).not.toHaveBeenCalled(); expect(props.onClose).toHaveBeenCalledOnce();
});
it("deletes both times only on confirmation", async () => {
  props = { ...props, startTime: "09:07", endTime: "10:13" }; await render(); await click("초기화");
  expect(save).not.toHaveBeenCalled(); await click("확인");
  expect(save.mock.calls[0][0].body).toEqual({ startTime: null, endTime: null });
});
it("cannot save a start change while the end has only been partially chosen", async () => {
  props = { ...props, startTime: "09:07" }; await render();
  await choose("분", "8"); await click("종료 시간"); await choose("오전/오후", "AM");
  expect(button("확인").disabled).toBe(true);
  await click("확인"); expect(save).not.toHaveBeenCalled();
});
it("keeps partial end choices when switching fields and never fills the missing minute", async () => {
  props = { ...props, startTime: "09:07" }; await render();
  await click("종료 시간"); await choose("오전/오후", "AM"); await choose("시", "1");
  await click("시작 시간"); await click("종료 시간");
  expect(button("확인").disabled).toBe(true); expect(save).not.toHaveBeenCalled();
  await choose("분", "5"); await click("확인");
  expect(save.mock.calls[0][0].body).toEqual({ endTime: "01:05" });
});
it.each([["AM", "00:07"], ["PM", "12:07"]])("explicit %s twelve saves %s", async (period, expected) => {
  await render(); await click("시작 시간");
  await choose("오전/오후", period); await choose("시", "0"); await choose("분", "7");
  await click("확인"); expect(save.mock.calls[0][0].body).toEqual({ startTime: expected });
});
it("a save failure keeps the chosen value and sheet open", async () => {
  props = { ...props, startTime: "09:07" }; await render(); await choose("분", "8");
  save.mockRejectedValueOnce(new Error("save failed")); await click("확인");
  expect(props.onClose).not.toHaveBeenCalled();
  expect(button("시작 시간").textContent).toContain("9:08");
});
it("blocks confirmation and field switching until a user scroll settles", async () => {
  props = { ...props, startTime: "09:07", endTime: "10:13" }; await render();
  await choose("분", "14");
  const hours = document.querySelector<HTMLElement>('[role="listbox"][aria-label="시"]')!;
  await act(async () => {
    hours.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    hours.scrollTop += 40;
    hours.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  expect(button("확인").disabled).toBe(true);
  expect(button("시작 시간").disabled).toBe(true);
  expect(save).not.toHaveBeenCalled();
  await act(async () => hours.dispatchEvent(new Event("scrollend", { bubbles: true })));
  await click("확인");
  expect(save.mock.calls[0][0].body).toEqual({ endTime: "11:14" });
});
it("releases pending scroll when an untouched server field is refreshed", async () => {
  props = { ...props, startTime: "09:07", endTime: "10:13" }; await render();
  const hours = document.querySelector<HTMLElement>('[role="listbox"][aria-label="시"]')!;
  await act(async () => {
    hours.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    hours.scrollTop += 40; hours.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  expect(button("시작 시간").disabled).toBe(true);
  props = { ...props, endTime: "11:13" }; await render();
  expect(button("시작 시간").disabled).toBe(false);
  expect(button("확인").disabled).toBe(true);
  expect(save).not.toHaveBeenCalled();
});
