// @vitest-environment jsdom
import { act, type DragEvent } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { hookHarness } from "@/test/hook-harness";
import { trackAnalyticsEvent } from "@/lib/analytics/track";
import { scheduleItemsQueryKey } from "@/lib/query-keys";
import type { RoomScheduleItem } from "@/lib/api/rooms";
import { usePlanItineraryReorder } from "./usePlanItineraryReorder";

const api = vi.hoisted(() => ({ reorder: vi.fn() }));
vi.mock("@/lib/client-env", () => ({ clientEnv: { NEXT_PUBLIC_API_BASE_URL: "https://api.example.test" } }));
vi.mock("@/lib/api/rooms", async (original) => ({ ...await original<object>(), reorderScheduleItem: api.reorder }));
vi.mock("@/lib/analytics/track", () => ({ AnalyticsEvents: { reorderItinerary: "reorder_itinerary" }, trackAnalyticsEvent: vi.fn() }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it("attributes a completed drag reorder to the request's room after the hook switches rooms", async () => {
  let resolve!: (items: RoomScheduleItem[]) => void;
  api.reorder.mockReturnValueOnce(new Promise<RoomScheduleItem[]>((yes) => { resolve = yes; }));
  const places = [{ id: "item-1", itemId: 1, title: "One" }, { id: "item-2", itemId: 2, title: "Two" }];
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  client.setQueryData(scheduleItemsQueryKey("room-a", 1), places);
  const hook = hookHarness((roomId: string) => usePlanItineraryReorder({ roomId, scheduleId: 1, places }),
    (child) => <QueryClientProvider client={client}>{child}</QueryClientProvider>);
  const data = new Map<string, string>();
  const dataTransfer = {
    setData: (key: string, value: string) => data.set(key, value),
    getData: (key: string) => data.get(key) ?? "",
    setDragImage: () => {},
    get types() { return Array.from(data.keys()); },
  } as unknown as DataTransfer;
  const rows = [0, 1].map((index) => {
    const row = document.createElement("div");
    row.getBoundingClientRect = () => ({ top: index * 100, left: 0, width: 200, height: 100, bottom: index * 100 + 100, right: 200, x: 0, y: index * 100, toJSON: () => ({}) });
    return row;
  });
  const event = { dataTransfer, currentTarget: rows[0], clientX: 10, clientY: 10, preventDefault: () => {} };
  try {
    await hook.render("room-a");
    rows.forEach((row, index) => hook.current.getRowProps(index, false).ref(row));
    await act(async () => hook.current.getRowProps(0, false).placeCardDragProps.onDragStart({ ...event, nativeEvent: event } as unknown as DragEvent<Element>));
    await act(async () => {
      hook.current.listContainerProps.onDragOver!({ ...event, clientY: 190 } as unknown as DragEvent<Element>);
      await new Promise((yes) => requestAnimationFrame(yes));
    });
    let operation!: Promise<void>;
    await act(async () => { operation = hook.current.listContainerProps.onDrop!(event as unknown as DragEvent<Element>); });
    expect(api.reorder).toHaveBeenCalledWith("room-a", 1, 1, { newOrderIndex: 1 });
    expect(trackAnalyticsEvent).not.toHaveBeenCalled();
    await hook.render("room-b");
    await act(async () => {
      resolve([2, 1].map((itemId, orderIndex) => ({ itemId, scheduleId: 1, googlePlaceId: `place-${itemId}`, orderIndex, startTime: null, endTime: null, travelMode: "DRIVING", createdAt: "2026-10-10" })));
      await operation;
    });
    expect(trackAnalyticsEvent).toHaveBeenCalledExactlyOnceWith("reorder_itinerary", expect.objectContaining({ room_id: "room-a" }));
  } finally {
    document.dispatchEvent(new Event("dragend"));
    await hook.unmount();
    client.clear();
  }
});
