import { beforeAll, describe, expect, it } from "vitest";

import type {
  CreateScheduleItemResponse,
  RoomScheduleItem,
} from "@/lib/api/rooms/schedule-items";
import type { PlanPlace } from "@/lib/plan/types";

let applyRoomScheduleItemToPlanPlaces: typeof import("@/lib/plan/scheduleItemPlaces").applyRoomScheduleItemToPlanPlaces;
let mergeCreatedScheduleItemDelta: typeof import("@/lib/plan/scheduleItemPlaces").mergeCreatedScheduleItemDelta;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:8080";
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "test-client";
  process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI = "http://localhost/callback";
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "test-maps-key";

  ({ applyRoomScheduleItemToPlanPlaces, mergeCreatedScheduleItemDelta } =
    await import("@/lib/plan/scheduleItemPlaces"));
});

const scheduleItem = (
  itemId: number,
  orderIndex: number,
  travelMode = "DRIVING",
): RoomScheduleItem => ({
  itemId,
  scheduleId: 10,
  googlePlaceId: `place-${itemId}`,
  startTime: null,
  endTime: null,
  orderIndex,
  travelMode,
  createdAt: "2026-07-16T00:00:00Z",
});

const planPlace = (itemId: number, travelMode = "DRIVING"): PlanPlace => ({
  id: `item-${itemId}`,
  itemId,
  googlePlaceId: `place-${itemId}`,
  title: `Place ${itemId}`,
  travelMode,
});

describe("mergeCreatedScheduleItemDelta", () => {
  it("inserts the created item at the server-returned middle index", () => {
    const response: CreateScheduleItemResponse = {
      createdItem: scheduleItem(3, 1),
      updatedItems: [scheduleItem(2, 2)],
      affectedRouteItemIds: [1],
    };

    const next = mergeCreatedScheduleItemDelta(
      [planPlace(1), planPlace(2)],
      planPlace(3),
      response,
    );

    expect(next?.map((place) => place.itemId)).toEqual([1, 3, 2]);
  });

  it("applies the recommended travel mode from updatedItems", () => {
    const response: CreateScheduleItemResponse = {
      createdItem: scheduleItem(3, 1),
      updatedItems: [scheduleItem(1, 0, "WALKING"), scheduleItem(2, 2)],
      affectedRouteItemIds: [1],
    };

    const next = mergeCreatedScheduleItemDelta(
      [planPlace(1), planPlace(2)],
      planPlace(3),
      response,
    );

    expect(next?.[0]?.travelMode).toBe("WALKING");
  });

  it("returns null when an updated item is missing from the current cache", () => {
    const response: CreateScheduleItemResponse = {
      createdItem: scheduleItem(3, 1),
      updatedItems: [scheduleItem(99, 2)],
      affectedRouteItemIds: [1],
    };

    const next = mergeCreatedScheduleItemDelta(
      [planPlace(1), planPlace(2)],
      planPlace(3),
      response,
    );

    expect(next).toBeNull();
  });
});

describe("applyRoomScheduleItemToPlanPlaces", () => {
  it("clears cached start and end time when the server returns null", () => {
    const prev: PlanPlace[] = [
      {
        id: "item-1",
        itemId: 1,
        googlePlaceId: "places/abc",
        title: "Old place",
        startTime: "09:00",
        endTime: "10:30",
        travelMode: "WALKING",
      },
    ];
    const updated: RoomScheduleItem = {
      itemId: 1,
      scheduleId: 10,
      googlePlaceId: "places/abc",
      startTime: null,
      endTime: null,
      orderIndex: 0,
      travelMode: "WALKING",
      createdAt: "2026-07-11T00:00:00Z",
    };

    const next = applyRoomScheduleItemToPlanPlaces(prev, updated);

    expect(next?.[0]).not.toHaveProperty("startTime");
    expect(next?.[0]).not.toHaveProperty("endTime");
  });
});

describe("end time cache and reorder", () => {
  it("merges an end-only change without losing memo or preview", () => {
    const prev = {
      ...planPlace(1),
      startTime: "23:00",
      endTime: "01:00",
      memo: "keep",
    };
    const next = applyRoomScheduleItemToPlanPlaces([prev], {
      ...scheduleItem(1, 0),
      startTime: "23:00",
      endTime: "02:00",
    });
    expect(next?.[0]).toMatchObject({
      startTime: "23:00",
      endTime: "02:00",
      memo: "keep",
      title: "Place 1",
    });
  });
  it("hydrates includeItems without a place preview", async () => {
    const { planPlaceFromItemAndPreview } =
      await import("./schedule-bulk-hydration");
    const item = {
      ...scheduleItem(1, 0),
      startTime: "23:00",
      endTime: "01:00",
    };
    expect(planPlaceFromItemAndPreview(item, null)).toMatchObject({
      startTime: "23:00",
      endTime: "01:00",
    });
  });
  it("merges server end times in insertion deltas", () => {
    const next = mergeCreatedScheduleItemDelta([planPlace(1)], planPlace(2), {
      createdItem: scheduleItem(2, 1),
      updatedItems: [
        { ...scheduleItem(1, 0), startTime: "00:00", endTime: "23:59" },
      ],
      affectedRouteItemIds: [],
    });
    expect(next?.[0]).toMatchObject({ startTime: "00:00", endTime: "23:59" });
  });
  it("chains reorder while retaining overnight duration, zero and unset ends", async () => {
    const { buildChainedStartPatchesForReorder } =
      await import("./scheduleItemPlaces");
    const items = [
      { ...scheduleItem(1, 0), startTime: "23:00", endTime: "01:00" },
      { ...scheduleItem(2, 1), startTime: "09:00", endTime: "09:00" },
      { ...scheduleItem(3, 2), startTime: null, endTime: null },
      { ...scheduleItem(4, 3), startTime: "00:00", endTime: "23:59" },
    ];
    expect(buildChainedStartPatchesForReorder(items)).toEqual([
      { itemId: 1, startTime: "00:00", endTime: "02:00" },
      { itemId: 2, startTime: "02:00", endTime: "02:00" },
      { itemId: 3, startTime: "02:00", endTime: null },
      { itemId: 4, startTime: "02:00", endTime: "01:59" },
    ]);
  });
});
