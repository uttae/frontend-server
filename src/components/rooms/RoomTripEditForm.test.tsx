// @vitest-environment jsdom
import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { RoomTripEditForm } from "./RoomTripEditForm";
import type { RoomTripEditFields } from "./RoomTripEditFields";
const state = vi.hoisted(() => ({
  fields: null as ComponentProps<typeof RoomTripEditFields> | null,
  update: vi.fn(),
}));
vi.mock("@/hooks/useRooms", () => ({
  useRoomSchedules: () => ({ data: [{}, {}, {}] }),
  useUpdateRoom: () => ({ mutate: state.update, isPending: false }),
}));
vi.mock("./RoomTripEditFields", () => ({
  RoomTripEditFields: (props: ComponentProps<typeof RoomTripEditFields>) => {
    state.fields = props;
    return null;
  },
}));
vi.mock("./TripDateShrinkConfirmModal", () => ({
  TripDateShrinkConfirmModal: () => <div data-confirm />,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
it("preserves drafts and original date floor on same-room refresh; reopening and room switch reset correctly", async () => {
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
  await act(async () => state.fields!.onTitleChange("draft"));
  await render({ ...room, destinations: [...room.destinations] });
  expect(state.fields!.values.title).toBe("draft");
  await act(async () => root.render(null));
  await render(room);
  expect(state.fields!.values.title).toBe("A");
  await act(async () => {
    state.fields!.onStartDateChange("2026-10-11");
    state.fields!.onEndDateChange("2026-10-11");
  });
  await act(async () => root.render(null));
  await render(room);
  expect(state.fields!.values.startDate).toBe("2026-10-10");
  expect(state.fields!.values.endDate).toBe("2026-10-12");
  expect(state.fields!.startDateMin).toBe("2026-10-10");
  await render({ ...room, startDate: "2026-10-11" });
  expect(state.fields!.startDateMin).toBe("2026-10-10");
  await act(async () => state.fields!.onEndDateChange("2026-10-11"));
  await act(async () => container.querySelector<HTMLButtonElement>("button")!.click());
  expect(container.querySelector("[data-confirm]")).not.toBeNull();
  await render({
    ...room,
    id: "b",
    title: "B",
    startDate: "2026-11-10",
    endDate: "2026-11-12",
  });
  expect(state.fields!.values.title).toBe("B");
  expect(state.fields!.startDateMin).toBe("2026-11-10");
  expect(container.querySelector("[data-confirm]")).toBeNull();
  expect(state.update).not.toHaveBeenCalled();
  await act(async () => root.unmount());
});

it("keeps the values from when it opened while the server changes and saves the form as shown", async () => {
  state.update.mockClear();
  const container = document.createElement("div");
  const root = createRoot(container);
  const apply = () => container.querySelector<HTMLButtonElement>("button")!;
  const room = { id: "r", title: "A", destinations: ["서울"], startDate: "2027-01-01", endDate: "2027-01-03" };
  await act(async () => root.render(<RoomTripEditForm room={room} />));
  // 열어 둔 사이 다른 멤버가 제목과 종료일을 바꿨다
  const changedByOther = { ...room, title: "B", endDate: "2027-01-05" };
  await act(async () => root.render(<RoomTripEditForm room={changedByOther} />));
  expect(state.fields!.values).toMatchObject({ title: "A", endDate: "2027-01-03" });
  expect(apply().disabled).toBe(true);
  // 서버 최신 기간(01-01~01-05)에서 잘리는 일차가 있으면 축소 확인을 띄운다
  await act(async () => state.fields!.onEndDateChange("2027-01-04"));
  await act(async () => apply().click());
  expect(container.querySelector("[data-confirm]")).not.toBeNull();
  expect(state.update).not.toHaveBeenCalled();
  await act(async () => root.unmount());

  // A가 28일로 연 사이 B가 시작일을 30일로 바꾸고, A가 제목만 고쳐 저장하면 A 화면의 28일이 저장된다
  const second = createRoot(container);
  const opened = { id: "r", title: "A", destinations: ["서울"], startDate: "2027-01-28", endDate: "2027-01-31" };
  await act(async () => second.render(<RoomTripEditForm room={opened} />));
  await act(async () => second.render(<RoomTripEditForm room={{ ...opened, startDate: "2027-01-30" }} />));
  expect(state.fields!.values.startDate).toBe("2027-01-28");
  await act(async () => state.fields!.onTitleChange("C"));
  await act(async () => apply().click());
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

it("does not submit draft edits and submits once for rapid apply clicks", async () => {
  state.update.mockClear();
  const container = document.createElement("div");
  const root = createRoot(container);
  const room = { id: "r", title: "old", destinations: ["서울"], startDate: "2027-01-01", endDate: "2027-01-03" };
  await act(async () => root.render(<RoomTripEditForm room={room} />));
  await act(async () => state.fields!.onTitleChange("cancelled"));
  expect(state.update).not.toHaveBeenCalled();
  await act(async () => state.fields!.onTitleChange("new"));
  await act(async () => {
    container.querySelector<HTMLButtonElement>("button")!.click();
    container.querySelector<HTMLButtonElement>("button")!.click();
  });
  expect(state.update).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
});
