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
}));
const update = { mutate: state.update, isPending: false, error: null } as unknown as ComponentProps<
  typeof RoomTripEditForm
>["update"];
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
    await act(async () => root.render(<RoomTripEditForm update={update} room={value} />));
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
  await act(async () => root.render(<RoomTripEditForm update={update} room={room} />));
  const changedByOther = { ...room, title: "B", endDate: "2027-01-05" };
  await act(async () => root.render(<RoomTripEditForm update={update} room={changedByOther} />));
  expect(titleInput(container).value).toBe("A");
  expect(state.dates!.value.end).toBe("2027-01-03");
  expect(applyButton(container).disabled).toBe(true);
  await changeDates(state.dates!.value.start, "2027-01-04");
  await act(async () => applyButton(container).click());
  expect(container.querySelector("[data-confirm]")).not.toBeNull();
  expect(state.update).not.toHaveBeenCalled();
  await act(async () => root.unmount());

  const second = createRoot(container);
  const opened = { id: "r", title: "A", destinations: ["서울"], startDate: "2027-01-28", endDate: "2027-01-31" };
  await act(async () => second.render(<RoomTripEditForm update={update} room={opened} />));
  await act(async () =>
    second.render(<RoomTripEditForm update={update} room={{ ...opened, startDate: "2027-01-30" }} />),
  );
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
  await act(async () => root.render(<RoomTripEditForm update={update} room={room} />));
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
  await act(async () => root.render(<RoomTripEditForm update={update} room={room} />));
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

it("shows each field's error under that field and blocks apply without locking the button", async () => {
  state.update.mockClear();
  const container = document.createElement("div");
  const root = createRoot(container);
  const room = { id: "r", title: "A", destinations: ["서울"], startDate: "2027-01-01", endDate: "2027-01-03" };
  await act(async () => root.render(<RoomTripEditForm update={update} room={room} />));
  expect(container.textContent).not.toContain("입력해 주세요");

  await typeTitle(container, "  ");
  expect(titleInput(container).getAttribute("aria-invalid")).toBe("true");
  const titleError = container.querySelector(`#${titleInput(container).getAttribute("aria-describedby")}`);
  expect(titleError?.textContent).toBe("여행 제목을 입력해 주세요.");
  expect(applyButton(container).disabled).toBe(false);
  await act(async () => applyButton(container).click());
  expect(state.update).not.toHaveBeenCalled();
  await typeTitle(container, "B");
  expect(titleInput(container).hasAttribute("aria-invalid")).toBe(false);
  expect(container.textContent).not.toContain("여행 제목을 입력해 주세요.");

  await act(async () => state.destinations!.onChange([]));
  expect(container.textContent).toContain("여행지를 하나 이상 선택해 주세요.");
  await act(async () => applyButton(container).click());
  expect(state.update).not.toHaveBeenCalled();
  await act(async () => state.destinations!.onChange(["부산"]));
  expect(container.textContent).not.toContain("여행지를 하나 이상 선택해 주세요.");

  await changeDates("2027-01-05", "2027-01-03");
  expect(container.textContent).toContain("종료일은 시작일 이후여야 해요.");
  await act(async () => applyButton(container).click());
  expect(state.update).not.toHaveBeenCalled();
  await changeDates("2027-01-01", "2027-01-03");
  expect(container.textContent).not.toContain("종료일은 시작일 이후여야 해요.");
  expect(state.update).not.toHaveBeenCalled();
  await act(async () => root.unmount());
});

it("blocks apply for a room opened without dates and shows the period error", async () => {
  state.update.mockClear();
  const container = document.createElement("div");
  const root = createRoot(container);
  const room = { id: "r", title: "A", destinations: ["서울"], startDate: null, endDate: null };
  await act(async () => root.render(<RoomTripEditForm update={update} room={room} />));
  await typeTitle(container, "B");
  await act(async () => applyButton(container).click());
  expect(state.update).not.toHaveBeenCalled();
  expect(container.textContent).toContain("여행 기간을 선택해 주세요.");
  await act(async () => root.unmount());
});

it("shows untouched field errors on the first apply even when another field already has an error", async () => {
  state.update.mockClear();
  const container = document.createElement("div");
  const root = createRoot(container);
  const room = { id: "r", title: "A", destinations: ["서울"], startDate: null, endDate: null };
  await act(async () => root.render(<RoomTripEditForm update={update} room={room} />));
  await typeTitle(container, " ");
  expect(container.textContent).toContain("여행 제목을 입력해 주세요.");
  await act(async () => applyButton(container).click());
  expect(state.update).not.toHaveBeenCalled();
  expect(container.textContent).toContain("여행 제목을 입력해 주세요.");
  expect(container.textContent).toContain("여행 기간을 선택해 주세요.");
  await act(async () => root.unmount());
});
