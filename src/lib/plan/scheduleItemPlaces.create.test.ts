import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CreateScheduleItemResponse,
  RoomScheduleItem,
} from "@/lib/api/rooms/schedule-items";
import type { PlanPlace } from "@/lib/plan/types";
import { scheduleItemsQueryKey } from "@/lib/query-keys";

const mocks = vi.hoisted(() => ({
  bumpForDirections: vi.fn(),
  bumpPlanMapRouteSegments: vi.fn(),
  createScheduleItem: vi.fn(),
  updateScheduleItem: vi.fn(),
  fetchPlacePreview: vi.fn(),
  getScheduleItems: vi.fn(),
  invalidateScheduleItemRouteForSources: vi.fn(),
  invalidateScheduleItemRouteForWholeSchedule: vi.fn(),
  invalidateScheduleItemRoutesAfterDelete: vi.fn(),
  invalidateScheduleItemRoutesAfterItemCreated: vi.fn(),
  readOrderedItemIdsFromScheduleItemsCache: vi.fn(),
}));

vi.mock("@/lib/api/rooms/schedule-items", () => ({
  createScheduleItem: mocks.createScheduleItem,
  getScheduleItems: mocks.getScheduleItems,
  updateScheduleItem: mocks.updateScheduleItem,
}));

vi.mock("@/lib/places/place-queries", () => ({
  fetchPlacePreview: mocks.fetchPlacePreview,
}));

vi.mock("@/lib/plan/scheduleStompRouteScope", () => ({
  bumpPlanMapRouteSegments: mocks.bumpPlanMapRouteSegments,
  invalidateScheduleItemRouteForSources:
    mocks.invalidateScheduleItemRouteForSources,
  invalidateScheduleItemRouteForWholeSchedule:
    mocks.invalidateScheduleItemRouteForWholeSchedule,
  invalidateScheduleItemRoutesAfterDelete:
    mocks.invalidateScheduleItemRoutesAfterDelete,
  invalidateScheduleItemRoutesAfterItemCreated:
    mocks.invalidateScheduleItemRoutesAfterItemCreated,
  invalidateScheduleItemRoutesAfterReorder: vi.fn(),
  readOrderedItemIdsFromScheduleItemsCache:
    mocks.readOrderedItemIdsFromScheduleItemsCache,
  removeRouteQueriesForDeletedItemSource: vi.fn(),
}));

vi.mock("@/lib/rooms", () => ({
  awaitRoomSchedulesHydrated: vi.fn(),
}));

vi.mock("@/lib/query-client", () => ({
  getQueryClient: vi.fn(),
}));

vi.mock("@/stores/plan-map-directions-epoch-store", () => ({
  usePlanMapDirectionsEpochStore: {
    getState: () => ({ bumpForDirections: mocks.bumpForDirections }),
  },
}));

let createScheduleItemAtPlanIndex: typeof import("@/lib/plan/scheduleItemPlaces").createScheduleItemAtPlanIndex;
let applyCreatedScheduleItemToPlanPlaces: typeof import("@/lib/plan/scheduleItemPlaces").applyCreatedScheduleItemToPlanPlaces;
let syncAfterCrossScheduleItemMove: typeof import("@/lib/plan/scheduleItemPlaces").syncAfterCrossScheduleItemMove;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:8080";
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "test-client";
  process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI = "http://localhost/callback";
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "test-maps-key";

  ({
    createScheduleItemAtPlanIndex,
    applyCreatedScheduleItemToPlanPlaces,
    syncAfterCrossScheduleItemMove,
  } = await import("@/lib/plan/scheduleItemPlaces"));
});

const scheduleItem = (itemId: number, orderIndex: number): RoomScheduleItem => ({
  itemId,
  scheduleId: 10,
  googlePlaceId: `place-${itemId}`,
  startTime: null,
  endTime: null,
  orderIndex,
  travelMode: "DRIVING",
  createdAt: "2026-07-16T00:00:00Z",
});

describe("createScheduleItemAtPlanIndex", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchPlacePreview.mockResolvedValue({
      name: "Created place",
      formattedAddress: "Address",
    });
    mocks.invalidateScheduleItemRouteForSources.mockResolvedValue(undefined);
    mocks.invalidateScheduleItemRoutesAfterItemCreated.mockResolvedValue(
      undefined,
    );
  });

  const response: CreateScheduleItemResponse = {
    createdItem: scheduleItem(3, 1),
    updatedItems: [scheduleItem(2, 2)],
    affectedRouteItemIds: [777],
  };
  const places = [
    { id: "item-1", itemId: 1, googlePlaceId: "place-1", title: "One" },
    { id: "item-2", itemId: 2, googlePlaceId: "place-2", title: "Two" },
  ];

  it("sends the dropped position as the server order index", async () => {
    mocks.createScheduleItem.mockResolvedValue(response);

    await expect(
      createScheduleItemAtPlanIndex({
        roomId: " room-1 ",
        scheduleId: 10,
        places,
        insertIndex: 5,
        googlePlaceId: "place-3",
      }),
    ).resolves.toBe(response);

    expect(mocks.createScheduleItem).toHaveBeenCalledWith("room-1", 10, {
      googlePlaceId: "place-3",
      orderIndex: 2,
    });
  });

  it("merges the create response and invalidates only the route IDs it returns", async () => {
    const queryClient = new QueryClient();
    const key = scheduleItemsQueryKey("room-1", 10);
    queryClient.setQueryData(key, places);

    await applyCreatedScheduleItemToPlanPlaces(queryClient, "room-1", 10, response);

    expect(
      queryClient.getQueryData<PlanPlace[]>(key)?.map((place) => place.itemId),
    ).toEqual([1, 3, 2]);
    expect(
      mocks.invalidateScheduleItemRoutesAfterItemCreated,
    ).not.toHaveBeenCalled();
    expect(mocks.invalidateScheduleItemRouteForSources).toHaveBeenCalledWith(
      queryClient,
      "room-1",
      10,
      [777],
    );
    expect(mocks.bumpPlanMapRouteSegments).toHaveBeenCalledWith(
      "room-1",
      10,
      [777],
    );
  });

  it("does not fail the saved create when post-create route synchronization fails", async () => {
    const queryClient = new QueryClient();
    mocks.invalidateScheduleItemRouteForSources.mockRejectedValueOnce(
      new Error("route sync failed"),
    );
    queryClient.setQueryData(scheduleItemsQueryKey("room-1", 10), places);

    await expect(
      applyCreatedScheduleItemToPlanPlaces(queryClient, "room-1", 10, response),
    ).resolves.toBeUndefined();

    expect(
      mocks.invalidateScheduleItemRouteForWholeSchedule,
    ).toHaveBeenCalledWith(queryClient, "room-1", 10);
    expect(mocks.bumpForDirections).toHaveBeenCalledWith("room-1");
  });

  it("maps server-provided move route IDs to the refreshed schedules", async () => {
    const queryClient = new QueryClient();
    mocks.getScheduleItems.mockResolvedValue([]);
    mocks.readOrderedItemIdsFromScheduleItemsCache.mockImplementation(
      (_queryClient: QueryClient, _roomId: string, scheduleId: number) =>
        scheduleId === 10 ? [11] : [20, 21],
    );

    await syncAfterCrossScheduleItemMove(
      queryClient,
      "room-1",
      10,
      20,
      20,
      [11, 21, 20],
    );

    expect(mocks.invalidateScheduleItemRoutesAfterDelete).not.toHaveBeenCalled();
    expect(
      mocks.invalidateScheduleItemRoutesAfterItemCreated,
    ).not.toHaveBeenCalled();
    expect(mocks.invalidateScheduleItemRouteForSources).toHaveBeenNthCalledWith(
      1,
      queryClient,
      "room-1",
      10,
      [11],
    );
    expect(mocks.invalidateScheduleItemRouteForSources).toHaveBeenNthCalledWith(
      2,
      queryClient,
      "room-1",
      20,
      [21, 20],
    );
    expect(
      mocks.invalidateScheduleItemRouteForWholeSchedule,
    ).not.toHaveBeenCalled();
  });
});

describe("cross-schedule refresh sequencing", () => {
  it("waits for source refresh before target and routes", async () => {
    const client = new QueryClient();
    let finishSource!: () => void;
    const source = new Promise<void>((resolve) => { finishSource = resolve; });
    const invalidate = vi.spyOn(client, "invalidateQueries").mockReturnValueOnce(source).mockResolvedValue(undefined);
    const syncing = syncAfterCrossScheduleItemMove(client, "room-1", 10, 20);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate.mock.calls[0][0]?.queryKey).toEqual(scheduleItemsQueryKey("room-1", 10));
    finishSource();
    await syncing;
    expect(invalidate.mock.calls[1][0]?.queryKey).toEqual(scheduleItemsQueryKey("room-1", 20));
  });
  it("refreshes identical source and target once", async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries").mockResolvedValue(undefined);
    await syncAfterCrossScheduleItemMove(client, "room-1", 10, 10);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });
  it("does not refresh target or routes when source refresh fails", async () => {
    vi.clearAllMocks();
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries").mockRejectedValue(new Error("source failed"));
    await expect(syncAfterCrossScheduleItemMove(client, "room-1", 10, 20)).rejects.toThrow("source failed");
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(mocks.invalidateScheduleItemRouteForWholeSchedule).not.toHaveBeenCalled();
  });
});

describe("reorder preserves user times", () => {
  it.each([
    [null, null], ["12:45", null], ["23:00", "01:00"], ["00:00", "00:00"],
  ])("keeps %s / %s and never sends a time PATCH", async (startTime, endTime) => {
    vi.clearAllMocks();
    const { syncPlanPlacesAfterReorderSuccess } = await import("./scheduleItemPlaces");
    const client = new QueryClient();
    const key = scheduleItemsQueryKey("room", 10);
    client.setQueryData(key, [1, 2].map((itemId) => ({ id: `item-${itemId}`, itemId, title: "Place" })));
    const items = [
      { ...scheduleItem(2, 0), startTime, endTime },
      { ...scheduleItem(1, 1), startTime: null, endTime: null },
    ];
    await syncPlanPlacesAfterReorderSuccess(client, "room", 10, items, 1);
    expect(mocks.updateScheduleItem).not.toHaveBeenCalled();
    expect(client.getQueryData<Array<{ itemId: number; startTime?: string; endTime?: string }>>(key)?.map(p =>
      [p.itemId, p.startTime ?? null, p.endTime ?? null])).toEqual([[2, startTime, endTime], [1, null, null]]);
    client.clear();
  });
});


it("cross-day move refresh preserves unset and partial times without a time PATCH", async () => {
  vi.clearAllMocks();
  const client = new QueryClient();
  client.setQueryData(scheduleItemsQueryKey("room", 10), [{ id: "item-1", itemId: 1, title: "One" }]);
  client.setQueryData(scheduleItemsQueryKey("room", 20), [{ id: "item-2", itemId: 2, title: "Two" }]);
  mocks.getScheduleItems.mockImplementation(async (_room, scheduleId) => scheduleId === 10
    ? [scheduleItem(1, 0)]
    : [{ ...scheduleItem(2, 0), scheduleId: 20, startTime: "12:45", endTime: null }]);
  const { schedulePlanPlacesQueryOptions } = await import("./scheduleItemPlaces");
  const unsubscribe = [10, 20].map((scheduleId) =>
    new QueryObserver(client, schedulePlanPlacesQueryOptions(client, "room", scheduleId))
      .subscribe(() => {}),
  );
  await syncAfterCrossScheduleItemMove(client, "room", 10, 20, 2, []);
  expect(mocks.updateScheduleItem).not.toHaveBeenCalled();
  expect(client.getQueryData<Array<{ startTime?: string; endTime?: string }>>(scheduleItemsQueryKey("room", 10))?.[0]).not.toHaveProperty("startTime");
  expect(client.getQueryData<Array<{ startTime?: string; endTime?: string }>>(scheduleItemsQueryKey("room", 20))?.[0]).toMatchObject({ startTime: "12:45" });
  expect(client.getQueryData<Array<{ startTime?: string; endTime?: string }>>(scheduleItemsQueryKey("room", 20))?.[0]).not.toHaveProperty("endTime");
  unsubscribe.forEach((stop) => stop());
  client.clear();
});
