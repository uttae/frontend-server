// @vitest-environment jsdom
import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { RoomTripEditForm } from "./RoomTripEditForm";
import type { DestinationChipsField } from "./DestinationChipsField";
import type { DateRangeField } from "@/components/date-picker/DateRangeField";
const state = vi.hoisted(() => ({
  destinations: null as ComponentProps<typeof DestinationChipsField> | null,
  dates: null as ComponentProps<typeof DateRangeField> | null,
  update: vi.fn(),
}));
vi.mock("@/hooks/useRooms", () => ({
  useRoomSchedules: () => ({ data: [{}, {}, {}] }),
  useUpdateRoom: () => ({ mutate: state.update, isPending: false }),
}));
// 목적지 검색(구글 장소)과 날짜 달력은 칸이 받은 값·onChange만 본다. 제목은 실제 입력 칸을 쓴다
vi.mock("./DestinationChipsField", () => ({
  DestinationChipsField: (props: ComponentProps<typeof DestinationChipsField>) => {
    state.destinations = props;
    return null;
  },
}));
vi.mock("@/components/date-picker/DateRangeField", () => ({
  DateRangeField: (props: ComponentProps<typeof DateRangeField>) => {
    state.dates = props;
    return null;
  },
}));
vi.mock("./TripDateShrinkConfirmModal", () => ({
  TripDateShrinkConfirmModal: () => <div data-confirm />,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const titleInput = (container: HTMLElement) => container.querySelector<HTMLInputElement>("input")!;
const applyButton = (container: HTMLElement) => container.querySelector<HTMLButtonElement>("button")!;
async function typeTitle(container: HTMLElement, value: string) {
  const input = titleInput(container);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function changeDates(start: string, end: string) {
  await act(async () => state.dates!.onChange({ start, end }));
}

it("preserves drafts on same-room refresh; reopening and room switch reset correctly", async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  const room = {
    id: "a",
    title: "A",
    destinations: ["서울"],
    startDate: "2026-10-10",
    endDate: "2026-10-12",
  };
  const render = async (value: typeof room) => {
    await act(async () => root.render(<RoomTripEditForm room={value} />));
  };
  await render(room);
  await typeTitle(container, "draft");
  await render({ ...room, destinations: [...room.destinations] });
  expect(titleInput(container).value).toBe("draft");
  await act(async () => root.render(null));
  await render(room);
  expect(titleInput(container).value).toBe("A");
  await changeDates("2026-10-11", "2026-10-11");
  await act(async () => root.render(null));
  await render(room);
  expect(state.dates!.value).toEqual({ start: "2026-10-10", end: "2026-10-12" });
  await render({ ...room, startDate: "2026-10-11" });
  await changeDates(state.dates!.value.start, "2026-10-11");
  await act(async () => applyButton(container).click());
  expect(container.querySelector("[data-confirm]")).not.toBeNull();
  await render({
    ...room,
    id: "b",
    title: "B",
    startDate: "2026-11-10",
    endDate: "2026-11-12",
  });
  expect(titleInput(container).value).toBe("B");
  expect(container.querySelector("[data-confirm]")).toBeNull();
  expect(state.update).not.toHaveBeenCalled();
  await act(async () => root.unmount());
});

it("keeps the values from when it opened while the server changes and saves the form as shown", async () => {
  state.update.mockClear();
  const container = document.createElement("div");
  const root = createRoot(container);
  const room = { id: "r", title: "A", destinations: ["서울"], startDate: "2027-01-01", endDate: "2027-01-03" };
  await act(async () => root.render(<RoomTripEditForm room={room} />));
  // 열어 둔 사이 다른 멤버가 제목과 종료일을 바꿨다
  const changedByOther = { ...room, title: "B", endDate: "2027-01-05" };
  await act(async () => root.render(<RoomTripEditForm room={changedByOther} />));
  expect(titleInput(container).value).toBe("A");
  expect(state.dates!.value.end).toBe("2027-01-03");
  expect(applyButton(container).disabled).toBe(true);
  // 서버 최신 기간(01-01~01-05)에서 잘리는 일차가 있으면 축소 확인을 띄운다
  await changeDates(state.dates!.value.start, "2027-01-04");
  await act(async () => applyButton(container).click());
  expect(container.querySelector("[data-confirm]")).not.toBeNull();
  expect(state.update).not.toHaveBeenCalled();
  await act(async () => root.unmount());

  // A가 28일로 연 사이 B가 시작일을 30일로 바꾸고, A가 제목만 고쳐 저장하면 A 화면의 28일이 저장된다
  const second = createRoot(container);
  const opened = { id: "r", title: "A", destinations: ["서울"], startDate: "2027-01-28", endDate: "2027-01-31" };
  await act(async () => second.render(<RoomTripEditForm room={opened} />));
  await act(async () => second.render(<RoomTripEditForm room={{ ...opened, startDate: "2027-01-30" }} />));
  expect(state.dates!.value.start).toBe("2027-01-28");
  await typeTitle(container, "C");
  await act(async () => applyButton(container).click());
  expect(state.update).toHaveBeenCalledWith(
    {
      roomId: "r",
      data: { title: "C", destinations: ["서울"], startDate: "2027-01-28", endDate: "2027-01-31" },
      previousStartDate: "2027-01-30",
      previousEndDate: "2027-01-31",
    },
    expect.objectContaining({ onSuccess: expect.any(Function) }),
  );
  await act(async () => second.unmount());
});

it("allows moving the start date earlier than the saved start date", async () => {
  state.update.mockClear();
  const container = document.createElement("div");
  const root = createRoot(container);
  const room = { id: "r", title: "A", destinations: ["서울"], startDate: "2027-01-04", endDate: "2027-01-11" };
  await act(async () => root.render(<RoomTripEditForm room={room} />));
  expect(state.dates!.min).toBeUndefined();
  await changeDates("2027-01-02", state.dates!.value.end);
  await act(async () => applyButton(container).click());
  expect(state.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ startDate: "2027-01-02", endDate: "2027-01-11" }),
    }),
    expect.anything(),
  );
  await act(async () => root.unmount());
});

it("does not submit draft edits and submits once for rapid apply clicks", async () => {
  state.update.mockClear();
  const container = document.createElement("div");
  const root = createRoot(container);
  const room = { id: "r", title: "old", destinations: ["서울"], startDate: "2027-01-01", endDate: "2027-01-03" };
  await act(async () => root.render(<RoomTripEditForm room={room} />));
  await typeTitle(container, "cancelled");
  expect(state.update).not.toHaveBeenCalled();
  await typeTitle(container, "new");
  await act(async () => {
    applyButton(container).click();
    applyButton(container).click();
  });
  expect(state.update).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
});

it("shows each field's error under that field and locks apply until it is fixed", async () => {
  state.update.mockClear();
  const container = document.createElement("div");
  const root = createRoot(container);
  const room = { id: "r", title: "A", destinations: ["서울"], startDate: "2027-01-01", endDate: "2027-01-03" };
  await act(async () => root.render(<RoomTripEditForm room={room} />));
  expect(container.textContent).not.toContain("입력해 주세요");

  // 제목을 비우면 제목 칸이 오류 상태가 되고 칸 아래에 문장이 붙는다
  await typeTitle(container, "  ");
  expect(titleInput(container).getAttribute("aria-invalid")).toBe("true");
  const titleError = container.querySelector(`#${titleInput(container).getAttribute("aria-describedby")}`);
  expect(titleError?.textContent).toBe("여행 제목을 입력해 주세요.");
  expect(applyButton(container).disabled).toBe(true);
  await typeTitle(container, "B");
  expect(titleInput(container).hasAttribute("aria-invalid")).toBe(false);
  expect(container.textContent).not.toContain("여행 제목을 입력해 주세요.");
  expect(applyButton(container).disabled).toBe(false);

  // 목적지를 모두 지우면 목적지 아래에 문장이 붙는다
  await act(async () => state.destinations!.onChange([]));
  expect(container.textContent).toContain("여행지를 하나 이상 선택해 주세요.");
  expect(applyButton(container).disabled).toBe(true);
  await act(async () => state.destinations!.onChange(["부산"]));
  expect(container.textContent).not.toContain("여행지를 하나 이상 선택해 주세요.");

  // 종료일이 시작일보다 앞서면 기간 아래에 문장이 붙는다
  await changeDates("2027-01-05", "2027-01-03");
  expect(container.textContent).toContain("종료일은 시작일 이후여야 해요.");
  expect(applyButton(container).disabled).toBe(true);
  await changeDates("2027-01-01", "2027-01-03");
  expect(container.textContent).not.toContain("종료일은 시작일 이후여야 해요.");
  expect(applyButton(container).disabled).toBe(false);
  expect(state.update).not.toHaveBeenCalled();
  await act(async () => root.unmount());
});
