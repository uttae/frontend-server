import { QueryClient } from "@tanstack/react-query";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CreateScheduleItemResponse,
  RoomScheduleItem,
} from "@/lib/api/rooms/schedule-items";
import { scheduleItemsQueryKey } from "@/lib/query-keys";

const mocks = vi.hoisted(() => ({
  bumpForDirections: vi.fn(),
  bumpPlanMapRouteSegments: vi.fn(),
  createScheduleItem: vi.fn(),
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
  updateScheduleItem: vi.fn(),
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
let syncAfterCrossScheduleItemMove: typeof import("@/lib/plan/scheduleItemPlaces").syncAfterCrossScheduleItemMove;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:8080";
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "test-client";
  process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI = "http://localhost/callback";
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "test-maps-key";

  ({ createScheduleItemAtPlanIndex, syncAfterCrossScheduleItemMove } =
    await import("@/lib/plan/scheduleItemPlaces"));
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

  it("invalidates the route IDs returned by the create response", async () => {
    const queryClient = new QueryClient();
    const response: CreateScheduleItemResponse = {
      createdItem: scheduleItem(3, 1),
      updatedItems: [scheduleItem(2, 2)],
      affectedRouteItemIds: [777],
    };
    mocks.createScheduleItem.mockResolvedValue(response);
    const places = [
      { id: "item-1", itemId: 1, googlePlaceId: "place-1", title: "One" },
      { id: "item-2", itemId: 2, googlePlaceId: "place-2", title: "Two" },
    ];
    queryClient.setQueryData(scheduleItemsQueryKey("room-1", 10), places);

    await createScheduleItemAtPlanIndex(queryClient, {
      roomId: "room-1",
      scheduleId: 10,
      places,
      insertIndex: 1,
      googlePlaceId: "place-3",
    });

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

  it("returns the created item when post-create route synchronization fails", async () => {
    const queryClient = new QueryClient();
    const response: CreateScheduleItemResponse = {
      createdItem: scheduleItem(3, 1),
      updatedItems: [scheduleItem(2, 2)],
      affectedRouteItemIds: [777],
    };
    mocks.createScheduleItem.mockResolvedValue(response);
    mocks.invalidateScheduleItemRouteForSources.mockRejectedValueOnce(
      new Error("route sync failed"),
    );
    const places = [
      { id: "item-1", itemId: 1, googlePlaceId: "place-1", title: "One" },
      { id: "item-2", itemId: 2, googlePlaceId: "place-2", title: "Two" },
    ];
    const key = scheduleItemsQueryKey("room-1", 10);
    queryClient.setQueryData(key, places);

    await expect(
      createScheduleItemAtPlanIndex(queryClient, {
        roomId: "room-1",
        scheduleId: 10,
        places,
        insertIndex: 1,
        googlePlaceId: "place-3",
      }),
    ).resolves.toEqual(response.createdItem);

    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
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
