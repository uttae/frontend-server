// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  room: { id: "room", title: "가을 여행", destinations: ["서울"], startDate: "2026-10-10", endDate: "2026-10-12", role: "HOST" },
  isHost: true, isLoading: false, missing: false, pending: false,
  update: vi.fn(),
}));
vi.mock("next/navigation", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/navigation")>()), useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock("@/components/layout/HeaderMemberPreview", () => ({ HeaderMemberPreview: () => null }));
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
const dateField = (edge: "start" | "end") => dialog()!.querySelector<HTMLButtonElement>(`#trip-room-${edge}`)!;
const picker = () => dialog()!.querySelector<HTMLElement>('[role="dialog"][aria-label="날짜 선택"]');
const day = (ymd: string) => picker()!.querySelector<HTMLButtonElement>(`button[data-ymd="${ymd}"]`)!;
/** 날짜 칸을 눌러 달력을 열고, 날짜를 차례로 누른 뒤 확인한다 */
async function pickDates(edge: "start" | "end", ...days: string[]) {
  await act(async () => dateField(edge).click());
  expect(picker()).not.toBeNull();
  for (const ymd of days) await act(async () => day(ymd).click());
  await click("확인", picker()!);
}
beforeEach(async () => {
  Object.assign(state.room, { title: "가을 여행", destinations: ["서울"], startDate: "2026-10-10", endDate: "2026-10-12" });
  state.room.role = "HOST"; state.isHost = true; state.isLoading = false; state.missing = false; state.pending = false;
  state.update.mockReset();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<HeaderBar />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it("opens one named modal beside the title and closing discards its draft with focus restoration", async () => {
  const trigger = await open();
  expect(trigger.parentElement?.textContent).toContain("가을 여행");
  expect(document.querySelectorAll("dialog[open]")).toHaveLength(1);
  expect(document.getElementById(dialog()!.getAttribute("aria-labelledby")!)?.textContent).toBe("여행 정보 수정");
  await change('input[type="text"]', "임시 제목");
  await click("여행 정보 수정 닫기", dialog()!);
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
  await pickDates("start", "2026-10-09");
  expect(dateField("start").getAttribute("aria-label")).toContain("2026년 10월 10일");
  expect(button("적용하기", dialog()!).disabled).toBe(true);
  // 종료 칸에서 시작일보다 이른 날짜를 고르면 기간을 거꾸로 만들지 않고 새 시작일이 되며, 종료일은 그대로다
  await pickDates("start", "2026-10-11", "2026-10-12");
  await pickDates("end", "2026-10-10");
  expect(dateField("start").getAttribute("aria-label")).toContain("2026년 10월 10일");
  expect(dateField("end").getAttribute("aria-label")).toContain("2026년 10월 12일");
  await click("서울 삭제", dialog()!);
  expect(button("적용하기", dialog()!).disabled).toBe(true);
  expect(state.update).not.toHaveBeenCalled();
});

it("changes only the picked date and leaves the other one", async () => {
  await open();
  await pickDates("start", "2026-10-11");
  expect(dateField("start").getAttribute("aria-label")).toContain("2026년 10월 11일");
  expect(dateField("end").getAttribute("aria-label")).toContain("2026년 10월 12일");
  await pickDates("end", "2026-10-13");
  expect(dateField("start").getAttribute("aria-label")).toContain("2026년 10월 11일");
  expect(dateField("end").getAttribute("aria-label")).toContain("2026년 10월 13일");
  // 아무것도 고르지 않고 닫으면 바꾸지 않는다
  await pickDates("start");
  expect(dateField("start").getAttribute("aria-label")).toContain("2026년 10월 11일");
});

it("keeps the opened values while the server changes, shows the change outside, and reflects it on reopen", async () => {
  await open();
  await act(async () => dateField("end").click());
  // 모달과 달력을 열어 둔 사이 다른 멤버가 제목과 종료일을 바꿨다
  Object.assign(state.room, { title: "겨울 여행", endDate: "2026-10-14" });
  await act(async () => root.render(<HeaderBar />));
  await click("확인", picker()!);
  expect(dialog()!.querySelector<HTMLInputElement>('input[type="text"]')!.value).toBe("가을 여행");
  expect(dateField("end").getAttribute("aria-label")).toContain("2026년 10월 12일");
  expect(button("적용하기", dialog()!).disabled).toBe(true);
  expect(button("여행 정보 수정", host).parentElement?.textContent).toContain("겨울 여행");
  await click("여행 정보 수정 닫기", dialog()!);
  await open();
  expect(dialog()!.querySelector<HTMLInputElement>('input[type="text"]')!.value).toBe("겨울 여행");
  expect(dateField("end").getAttribute("aria-label")).toContain("2026년 10월 14일");
  expect(state.update).not.toHaveBeenCalled();
});

it("lets members save travel information without granting deletion", async () => {
  state.isHost = false; state.room.role = "MEMBER"; await open();
  await change('input[type="text"]', "멤버 수정");
  await click("적용하기", dialog()!);
  expect(state.update).toHaveBeenCalledWith(expect.objectContaining({
    roomId: "room", data: expect.objectContaining({ title: "멤버 수정" }),
  }), expect.any(Object));
  expect(dialog()!.textContent).not.toContain("여행 삭제");
});

it.each(["PENDING", "", "UNKNOWN"])("denies editing for unrecognized membership %s", async (role) => {
  state.isHost = false; state.room.role = role; await open();
  expect(dialog()!.querySelector("input")).toBeNull();
  expect(dialog()!.textContent).not.toContain("적용하기");
  expect(state.update).not.toHaveBeenCalled();
});

it.each(["loading", "missing"])("does not offer editing for %s room data", async (mode) => {
  state.isLoading = mode === "loading"; state.missing = mode === "missing";
  await open();
  expect(dialog()!.querySelector("input")).toBeNull();
  if (mode === "missing") expect(dialog()!.textContent).toContain("여행 정보를 불러오지 못했어요.");
});

it("contains shrink confirmation focus and Escape dismisses only confirmation, preserving the draft", async () => {
  await open();
  await pickDates("end", "2026-10-10");
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
  expect(dateField("end").getAttribute("aria-label")).toContain("2026년 10월 10일");
  expect(document.activeElement).toBe(button("적용하기", dialog()!));
  expect(state.update).not.toHaveBeenCalled();
});

it("names the existing title, destination and date fields", async () => {
  await open();
  const modal = dialog()!;
  const inputs = [...modal.querySelectorAll("input")];
  const names = inputs.map(input => input.getAttribute("aria-label") || [...(input.labels ?? [])].map(label => label.textContent).join(""));
  expect(names).toContain("여행 제목");
  expect(names).toContain("목적지 검색");
  expect(dateField("start").getAttribute("aria-label")).toBe("시작 날짜 2026년 10월 10일 토요일");
  expect(dateField("end").getAttribute("aria-label")).toBe("종료 날짜 2026년 10월 12일 월요일");
});

it("opens the date picker from either date field without submitting the form", async () => {
  await open();
  for (const edge of ["start", "end"] as const) {
    expect(dateField(edge).type).toBe("button");
    expect(dateField(edge).getAttribute("aria-haspopup")).toBe("dialog");
    await act(async () => dateField(edge).click());
    expect(picker()).not.toBeNull();
    await click("취소", picker()!);
    expect(picker()).toBeNull();
  }
  expect(state.update).not.toHaveBeenCalled();
});
