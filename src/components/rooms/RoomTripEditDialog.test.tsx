// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  room: { id: "room", title: "가을 여행", destinations: ["서울"], startDate: "2026-10-10", endDate: "2026-10-12" },
  isHost: true, isLoading: false, missing: false, pending: false,
  update: vi.fn(),
}));
vi.mock("@/hooks/use-room-id", () => ({ useCurrentRoomId: () => ({ roomId: "room" }) }));
vi.mock("@/hooks/useRoomDetail", () => ({ useRoomDetail: () => ({ data: state.room }) }));
vi.mock("@/hooks/useRooms", () => ({
  useRoomsList: () => ({ data: { rooms: [state.room] }, isPending: false }),
  useRoomSchedules: () => ({ data: [{}, {}, {}] }),
  useUpdateRoom: () => ({ mutate: state.update, isPending: state.pending }),
}));
vi.mock("@/hooks/useCurrentRoomMembership", () => ({
  useCurrentRoomMembership: () => ({ roomId: "room", roomSource: state.missing ? null : state.room, isHost: state.isHost, isLoading: state.isLoading }),
}));
vi.mock("@vis.gl/react-google-maps", () => ({ useMapsLibrary: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
import HeaderBar from "@/components/layout/HeaderBar";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement;
let root: Root;
const dialog = () => document.querySelector<HTMLDialogElement>("dialog[open]");
const button = (label: string, scope: ParentNode = document) => {
  const node = [...scope.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.getAttribute("aria-label") === label || item.textContent === label,
  );
  expect(node, `button ${label}`).toBeDefined();
  return node!;
};
async function click(label: string, scope: ParentNode = document) {
  await act(async () => button(label, scope).click());
}
async function change(selector: string, value: string) {
  const input = dialog()!.querySelector<HTMLInputElement>(selector)!;
  expect(input).not.toBeNull();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
async function open() {
  const trigger = button("여행 정보 수정", host);
  trigger.focus();
  await click("여행 정보 수정", host);
  return trigger;
}
beforeEach(async () => {
  state.isHost = true; state.isLoading = false; state.missing = false; state.pending = false;
  state.update.mockReset();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<HeaderBar />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it("opens one named modal beside the title and cancel discards its draft with focus restoration", async () => {
  const trigger = await open();
  expect(trigger.parentElement?.textContent).toContain("가을 여행");
  expect(document.querySelectorAll("dialog[open]")).toHaveLength(1);
  expect(document.getElementById(dialog()!.getAttribute("aria-labelledby")!)?.textContent).toBe("여행 정보 수정");
  await change('input[type="text"]', "임시 제목");
  await click("취소", dialog()!);
  expect(dialog()).toBeNull(); expect(document.activeElement).toBe(trigger);
  await open();
  expect(dialog()!.querySelector<HTMLInputElement>('input[type="text"]')!.value).toBe("가을 여행");
  expect(state.update).not.toHaveBeenCalled();
});

it("uses the existing trimmed mutation payload and closes only after save succeeds", async () => {
  await open(); await change('input[type="text"]', " 새 제목 ");
  await click("적용하기", dialog()!);
  expect(state.update).toHaveBeenCalledWith({
    roomId: "room", data: { title: "새 제목", destinations: ["서울"], startDate: "2026-10-10", endDate: "2026-10-12" },
    previousStartDate: "2026-10-10", previousEndDate: "2026-10-12",
  }, expect.objectContaining({ onSuccess: expect.any(Function) }));
  expect(dialog()).not.toBeNull();
  await act(async () => state.update.mock.calls[0][1].onSuccess());
  expect(dialog()).toBeNull();
});

it("retains the original date floor, date ordering and required destination validation", async () => {
  await open();
  await change('input[type="date"]', "2026-10-09");
  expect(button("적용하기", dialog()!).disabled).toBe(true);
  await change('input[type="date"]', "2026-10-13");
  expect(button("적용하기", dialog()!).disabled).toBe(true);
  await change('input[type="date"]', "2026-10-10");
  await click("서울 삭제", dialog()!);
  expect(button("적용하기", dialog()!).disabled).toBe(true);
  expect(state.update).not.toHaveBeenCalled();
});

it("shows nonhost travel information without editable fields or a save action", async () => {
  state.isHost = false; await open();
  expect(dialog()!.textContent).toContain("방장만 여행 정보를 수정할 수 있어요.");
  expect(dialog()!.querySelector("input")).toBeNull();
  expect(dialog()!.textContent).not.toContain("적용하기");
});

it.each(["loading", "missing"])("does not offer editing for %s room data", async (mode) => {
  state.isLoading = mode === "loading"; state.missing = mode === "missing";
  await open();
  expect(dialog()!.querySelector("input")).toBeNull();
  if (mode === "missing") expect(dialog()!.textContent).toContain("여행 정보를 불러오지 못했어요.");
});

it("contains shrink confirmation focus and Escape dismisses only confirmation, preserving the draft", async () => {
  await open();
  await change('input[id="trip-room-end"]', "2026-10-10");
  button("적용하기", dialog()!).focus();
  await click("적용하기", dialog()!);
  const confirm = document.querySelector('[role="alertdialog"]')!;
  expect(confirm).not.toBeNull();
  expect(confirm.contains(document.activeElement)).toBe(true);
  await act(async () => {
    button("계속하기", confirm).focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
  });
  expect(document.activeElement).toBe(button("취소", confirm));
  await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  expect(dialog()).not.toBeNull();
  expect(dialog()!.querySelector<HTMLInputElement>('#trip-room-end')!.value).toBe("2026-10-10");
  expect(document.activeElement).toBe(button("적용하기", dialog()!));
  expect(state.update).not.toHaveBeenCalled();
});
