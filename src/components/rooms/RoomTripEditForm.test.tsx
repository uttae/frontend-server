// @vitest-environment jsdom
import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { RoomTripEditForm } from "./RoomTripEditForm";
import type { TripFormFields } from "./TripFormFields";
const state = vi.hoisted(() => ({
  fields: null as ComponentProps<typeof TripFormFields> | null,
  update: vi.fn(),
}));
vi.mock("@/hooks/useRooms", () => ({
  useRoomSchedules: () => ({ data: [{}, {}, {}] }),
  useUpdateRoom: () => ({ mutate: state.update, isPending: false }),
}));
vi.mock("./TripFormFields", () => ({
  TripFormFields: (props: ComponentProps<typeof TripFormFields>) => {
    state.fields = props;
    return null;
  },
}));
vi.mock("./TripDateShrinkConfirmModal", () => ({
  TripDateShrinkConfirmModal: () => <div data-confirm />,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
it("preserves drafts and original date floor on same-room refresh; cancel and room switch reset correctly", async () => {
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
  await act(async () => container.querySelectorAll("button")[0].click());
  expect(state.fields!.values.title).toBe("A");
  await act(async () => {
    state.fields!.onStartDateChange("2026-10-11");
    state.fields!.onEndDateChange("2026-10-11");
  });
  expect(state.fields!.endDateMin).toBe("2026-10-11");
  await act(async () => container.querySelectorAll("button")[0].click());
  expect(state.fields!.values.startDate).toBe("2026-10-10");
  expect(state.fields!.values.endDate).toBe("2026-10-12");
  expect(state.fields!.startDateMin).toBe("2026-10-10");
  await render({ ...room, startDate: "2026-10-11" });
  expect(state.fields!.startDateMin).toBe("2026-10-10");
  await act(async () => state.fields!.onEndDateChange("2026-10-11"));
  await act(async () => container.querySelectorAll("button")[1].click());
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
  expect(state.fields!.endDateMin).toBe("2026-11-10");
  expect(container.querySelector("[data-confirm]")).toBeNull();
  expect(state.update).not.toHaveBeenCalled();
  await act(async () => root.unmount());
});
