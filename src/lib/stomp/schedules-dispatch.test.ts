import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RoomScheduleChangedEvent } from "@/lib/stomp/schedule-events";

const mocks = vi.hoisted(() => ({
  collectSegmentSourcesForCreate: vi.fn(),
  collectSegmentSourcesForDelete: vi.fn(),
  collectSegmentSourcesForReorder: vi.fn(),
  getScheduleItems: vi.fn(),
  invalidateScheduleItemRouteForSources: vi.fn(),
  invalidateScheduleItemRouteForWholeSchedule: vi.fn(),
  mergeOrRefetchSchedulePlanPlacesFromItems: vi.fn(),
  readOrderedItemIdsFromScheduleItemsCache: vi.fn(),
  refetchSchedulePlanPlacesIntoCache: vi.fn(),
  removeRouteQueriesForDeletedItemSource: vi.fn(),
  syncAfterCrossScheduleItemMove: vi.fn(),
}));

vi.mock("@/lib/api/rooms/schedule-items", () => ({
  getScheduleItems: mocks.getScheduleItems,
}));

vi.mock("@/lib/plan/scheduleItemPlaces", () => ({
  mergeOrRefetchSchedulePlanPlacesFromItems:
    mocks.mergeOrRefetchSchedulePlanPlacesFromItems,
  refetchSchedulePlanPlacesIntoCache: mocks.refetchSchedulePlanPlacesIntoCache,
  syncAfterCrossScheduleItemMove: mocks.syncAfterCrossScheduleItemMove,
}));

vi.mock("@/lib/plan/scheduleStompRouteScope", () => ({
  collectSegmentSourcesForCreate: mocks.collectSegmentSourcesForCreate,
  collectSegmentSourcesForDelete: mocks.collectSegmentSourcesForDelete,
  collectSegmentSourcesForReorder: mocks.collectSegmentSourcesForReorder,
  invalidateScheduleItemRouteForSources:
    mocks.invalidateScheduleItemRouteForSources,
  invalidateScheduleItemRouteForWholeSchedule:
    mocks.invalidateScheduleItemRouteForWholeSchedule,
  readOrderedItemIdsFromScheduleItemsCache:
    mocks.readOrderedItemIdsFromScheduleItemsCache,
  removeRouteQueriesForDeletedItemSource:
    mocks.removeRouteQueriesForDeletedItemSource,
}));

vi.mock("@/lib/rooms", () => ({
  hydrateRoomSchedulesFromServer: vi.fn(),
  syncRoomDetailFromServer: vi.fn(),
}));

vi.mock("@/stores/plan-map-directions-epoch-store", () => ({
  usePlanMapDirectionsEpochStore: {
    getState: () => ({
      bumpForDirections: vi.fn(),
      bumpSegments: vi.fn(),
    }),
  },
}));

import { dispatchRoomScheduleEvent } from "@/lib/stomp/schedules-dispatch";

function itemEvent(
  type: RoomScheduleChangedEvent["type"],
  affectedRouteItemIds: number[],
): RoomScheduleChangedEvent {
  return {
    roomId: "room-1",
    actorUserId: 99,
    type,
    scheduleId: 10,
    itemId: 20,
    affectedRouteItemIds,
    scheduleIds: null,
  };
}

describe("dispatchRoomScheduleEvent", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    vi.clearAllMocks();
    mocks.getScheduleItems.mockResolvedValue([]);
    mocks.invalidateScheduleItemRouteForSources.mockResolvedValue(undefined);
    mocks.invalidateScheduleItemRouteForWholeSchedule.mockResolvedValue(
      undefined,
    );
    mocks.mergeOrRefetchSchedulePlanPlacesFromItems.mockResolvedValue(undefined);
    mocks.refetchSchedulePlanPlacesIntoCache.mockResolvedValue(undefined);
    mocks.syncAfterCrossScheduleItemMove.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    queryClient.clear();
  });

  it("uses affectedRouteItemIds instead of calculating routes for a created item", async () => {
    mocks.readOrderedItemIdsFromScheduleItemsCache.mockReturnValue([10, 20]);
    mocks.collectSegmentSourcesForCreate.mockReturnValue({
      sources: [10, 20],
      useFallback: false,
    });

    await dispatchRoomScheduleEvent(
      queryClient,
      itemEvent("SCHEDULE_ITEM_CREATED", [777]),
    );

    expect(mocks.collectSegmentSourcesForCreate).not.toHaveBeenCalled();
    expect(mocks.invalidateScheduleItemRouteForSources).toHaveBeenCalledWith(
      queryClient,
      "room-1",
      10,
      [777],
    );
  });

  it("uses affectedRouteItemIds instead of calculating routes for a deleted item", async () => {
    mocks.collectSegmentSourcesForDelete.mockReturnValue({
      sources: [10],
      useFallback: false,
    });

    await dispatchRoomScheduleEvent(
      queryClient,
      itemEvent("SCHEDULE_ITEM_DELETED", [888]),
    );

    expect(mocks.collectSegmentSourcesForDelete).not.toHaveBeenCalled();
    expect(mocks.invalidateScheduleItemRouteForSources).toHaveBeenCalledWith(
      queryClient,
      "room-1",
      10,
      [888],
    );
  });

  it("uses affectedRouteItemIds instead of calculating routes after reorder", async () => {
    vi.useFakeTimers();
    mocks.collectSegmentSourcesForReorder.mockReturnValue({
      sources: [10, 20],
      useFallback: false,
    });

    await dispatchRoomScheduleEvent(
      queryClient,
      itemEvent("SCHEDULE_ITEMS_REORDERED", [999]),
    );
    await vi.runAllTimersAsync();

    expect(mocks.collectSegmentSourcesForReorder).not.toHaveBeenCalled();
    expect(mocks.invalidateScheduleItemRouteForSources).toHaveBeenCalledWith(
      queryClient,
      "room-1",
      10,
      [999],
    );
  });

  it("passes affectedRouteItemIds through a cross-schedule move", async () => {
    const event = itemEvent("SCHEDULE_ITEM_MOVED", [11, 21, 20]);
    event.scheduleId = 20;
    event.scheduleIds = [10, 20];

    await dispatchRoomScheduleEvent(queryClient, event);

    expect(mocks.syncAfterCrossScheduleItemMove).toHaveBeenCalledWith(
      queryClient,
      "room-1",
      10,
      20,
      20,
      [11, 21, 20],
    );
  });

  it("refreshes travel mode before invalidating affectedRouteItemIds", async () => {
    vi.useFakeTimers();
    const order: string[] = [];
    mocks.getScheduleItems.mockImplementation(async () => {
      order.push("refetch");
      return [];
    });
    mocks.invalidateScheduleItemRouteForSources.mockImplementation(async () => {
      order.push("invalidate");
    });

    await dispatchRoomScheduleEvent(
      queryClient,
      itemEvent("SCHEDULE_ITEM_TRAVEL_MODE_UPDATED", [20]),
    );
    await vi.runAllTimersAsync();

    expect(order).toEqual(["refetch", "invalidate"]);
    expect(mocks.invalidateScheduleItemRouteForSources).toHaveBeenCalledWith(
      queryClient,
      "room-1",
      10,
      [20],
    );
  });

  it("preserves a newer route bucket when an earlier travel-mode refresh fails", async () => {
    vi.useFakeTimers();
    let rejectFirst!: (reason?: unknown) => void;
    let resolveSecond!: (value: never[]) => void;
    const first = new Promise<never[]>((_, reject) => {
      rejectFirst = reject;
    });
    const second = new Promise<never[]>((resolve) => {
      resolveSecond = resolve;
    });
    mocks.getScheduleItems
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);

    await dispatchRoomScheduleEvent(
      queryClient,
      itemEvent("SCHEDULE_ITEM_TRAVEL_MODE_UPDATED", [20]),
    );
    await vi.advanceTimersByTimeAsync(90);

    await dispatchRoomScheduleEvent(
      queryClient,
      itemEvent("SCHEDULE_ITEM_TRAVEL_MODE_UPDATED", [30]),
    );
    await vi.advanceTimersByTimeAsync(90);

    rejectFirst(new Error("first refresh failed"));
    resolveSecond([]);
    await vi.runAllTimersAsync();

    expect(mocks.invalidateScheduleItemRouteForSources).toHaveBeenCalledTimes(1);
    expect(mocks.invalidateScheduleItemRouteForSources).toHaveBeenCalledWith(
      queryClient,
      "room-1",
      10,
      [30],
    );
  });
});

describe("expense synchronization on existing schedule events",()=>{
 it.each(["ROOM_SCHEDULES_RESYNCED","SCHEDULE_ITEM_MOVED","SCHEDULE_ITEM_DELETED"] as const)("invalidates expense list and summary for %s even self events",async type=>{
  const client = new QueryClient();
  client.setQueryData(["session","user"],{id:99});
  for(const suffix of ["list","summary"])client.setQueryData(["room-expenses","room-1",suffix],[]);
  await dispatchRoomScheduleEvent(client,{...itemEvent(type,[]),scheduleIds:[10,11]});
  for(const suffix of ["list","summary"])expect(client.getQueryState(["room-expenses","room-1",suffix])?.isInvalidated).toBe(true);
  client.clear();
 });
});
