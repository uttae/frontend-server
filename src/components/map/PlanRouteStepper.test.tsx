// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { PlanPlace } from "@/lib/plan/types";
import { scheduleItemsQueryKey } from "@/lib/query-keys";
import { PLAN_MAP_FOCUS_NO_LOCATION_MESSAGE, usePlanMapFocusStore } from "@/stores/plan-map-focus-store";

import { PlanRouteStepper } from "./PlanRouteStepper";

const state = vi.hoisted(() => ({ select: vi.fn(), toast: vi.fn() }));
vi.mock("@/hooks/useRooms", () => ({ useRoomSchedules: () => ({ isSuccess: true }) }));
vi.mock("@/contexts/SelectedPlaceContext", () => ({ useSelectedPlace: () => ({ setSelectedPlace: state.select }) }));
vi.mock("sonner", () => ({ toast: { info: state.toast } }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const places: PlanPlace[] = [
  { id: "a", title: "A", itemId: 1, googlePlaceId: "ga", location: { lat: 1, lng: 1 } },
  { id: "b", title: "B", itemId: 2, googlePlaceId: "gb", location: { lat: 2, lng: 2 } },
  { id: "c", title: "C", itemId: 3, googlePlaceId: "gc" },
];
let host: HTMLDivElement;
let root: Root;
const group = () => host.querySelector<HTMLElement>('[role="group"][aria-label="장소 이동"]');
const button = (label: string) => group()!.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
const position = () => group()!.querySelector("p > span[aria-hidden]")!.textContent;
function focusItem(itemId: number) {
  usePlanMapFocusStore.setState({
    focus: { roomId: "room", scheduleId: 10, itemId, googlePlaceId: null, location: null, source: "card", seq: 1 },
  });
}

beforeEach(async () => {
  state.select.mockReset();
  state.toast.mockReset();
  const queryClient = new QueryClient();
  queryClient.setQueryData(scheduleItemsQueryKey("room", 10), places);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  usePlanMapFocusStore.setState({ focus: null });
  await act(async () =>
    root.render(
      <QueryClientProvider client={queryClient}>
        <PlanRouteStepper roomId="room" />
      </QueryClientProvider>,
    ),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

it("is hidden until a place of the itinerary is focused", () => {
  expect(group()).toBeNull();
});

it("shows the order within the day and disables the edge buttons", async () => {
  await act(async () => focusItem(1));
  expect(position()).toBe("1/3");
  expect(button("이전 장소").disabled).toBe(true);
  expect(button("다음 장소").disabled).toBe(false);
  await act(async () => focusItem(3));
  expect(position()).toBe("3/3");
  expect(button("다음 장소").disabled).toBe(true);
});

it("moves the focus like a card click without opening the detail and asks the list to reveal it", async () => {
  await act(async () => focusItem(1));
  await act(async () => button("다음 장소").click());
  expect(usePlanMapFocusStore.getState().focus).toMatchObject({
    roomId: "room", scheduleId: 10, itemId: 2, googlePlaceId: "gb", location: { lat: 2, lng: 2 }, source: "stepper",
  });
  expect(state.select).toHaveBeenCalledWith(null);
  expect(position()).toBe("2/3");
  expect(state.toast).not.toHaveBeenCalled();
});

it("keeps places without a location in the order and tells the user the map cannot move", async () => {
  await act(async () => focusItem(2));
  await act(async () => button("다음 장소").click());
  expect(usePlanMapFocusStore.getState().focus).toMatchObject({ itemId: 3, location: null, source: "stepper" });
  expect(state.toast).toHaveBeenCalledWith(PLAN_MAP_FOCUS_NO_LOCATION_MESSAGE);
});
