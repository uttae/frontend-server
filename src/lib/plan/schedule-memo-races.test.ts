import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClient, registerQueryClient } from "@/lib/query-client";
import { scheduleItemsQueryKey, roomSchedulesQueryKey } from "@/lib/query-keys";
const api = vi.hoisted(() => ({ items: vi.fn(), schedules: vi.fn() }));
vi.mock("@/lib/api/rooms/schedule-items", async (original) => ({ ...await original<object>(), getScheduleItems: api.items }));
vi.mock("@/lib/api/rooms/schedules", async (original) => ({ ...await original<object>(), getRoomSchedules: api.schedules }));
vi.mock("@/lib/places/place-queries", () => ({ fetchPlacePreview: async () => { throw new Error("no preview"); }, resolvePreviewGooglePlaceId: (id: string) => id, placePreviewQueryKey: (id: string) => ["preview", id] }));
vi.mock("@/lib/places/place-batch-cache", () => ({ fetchAndSeedPlacePreviews: async () => {} }));
let places: typeof import("./scheduleItemPlaces");
let rooms: typeof import("@/lib/rooms");
beforeAll(async () => {
  process.env.NEXT_PUBLIC_API_BASE_URL = "http://fixture.test";
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "test-client";
  process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI = "http://fixture.test/callback";
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "test-key";
  places = await import("./scheduleItemPlaces"); rooms = await import("@/lib/rooms");
});
beforeEach(() => { api.items.mockReset(); api.schedules.mockReset(); });
const item = { itemId: 1, scheduleId: 10, googlePlaceId: "p", startTime: null, endTime: null, memo: "old", memoVersion: 1, orderIndex: 0, travelMode: "DRIVING", createdAt: "2026-09-17T00:00:00Z" };
const key = scheduleItemsQueryKey("r", 10);
function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }
function setup() { const qc = createQueryClient(); registerQueryClient(qc); qc.setQueryData(key, [{ ...item, id: "item-1", title: "place" }]); return qc; }

describe("memo-bearing REST races", () => {
  it("does not resurrect an item when an older WS refresh completes after delete", async () => {
    const qc = setup(); const response = deferred<typeof item[]>(); api.items.mockReturnValueOnce(response.promise);
    const pending = places.refetchSchedulePlanPlacesIntoCache(qc, "r", 10);
    places.removeScheduleItemFromPlanPlacesCache(qc, "r", 10, 1);
    response.resolve([item]); await pending;
    expect(qc.getQueryData(key)).toEqual([]);
  });
  it("does not resurrect deleted items from older includeItems hydration", async () => {
    const qc = setup(); const response = deferred<unknown>(); api.schedules.mockReturnValueOnce(response.promise);
    const pending = rooms.hydrateRoomSchedulesFromServer(qc, "r");
    places.removeScheduleItemFromPlanPlacesCache(qc, "r", 10, 1);
    response.resolve([{ scheduleId: 10, roomId: "r", dayNumber: 1, items: [item] }]); await pending;
    expect(qc.getQueryData(key)).toEqual([]);
  });
  it("preserves newer memo through a late list response", async () => {
    const qc = setup(); const response = deferred<typeof item[]>(); api.items.mockReturnValueOnce(response.promise);
    const pending = places.refetchSchedulePlanPlacesIntoCache(qc, "r", 10);
    qc.setQueryData(key, [{ ...item, id: "item-1", title: "place", memo: "new", memoVersion: 3 }]);
    response.resolve([item]); await pending;
    expect(qc.getQueryData(key)).toMatchObject([{ memo: "new", memoVersion: 3 }]);
  });
  it("preserves lower-version rejection when a queryFn returns the raw room response", async () => {
    const qc = setup(); qc.setQueryData(key, [{ ...item, id: "item-1", title: "place", memo: "new", memoVersion: 3 }]);
    api.schedules.mockResolvedValue([{ scheduleId: 10, roomId: "r", dayNumber: 1, items: [item] }]);
    await qc.fetchQuery({ queryKey: roomSchedulesQueryKey("r"), queryFn: () => rooms.hydrateRoomSchedulesFromServer(qc, "r") });
    expect(qc.getQueryData(roomSchedulesQueryKey("r"))).toMatchObject([{ items: [{ memo: "new", memoVersion: 3 }] }]);
    expect(qc.getQueryData(key)).toMatchObject([{ memo: "new", memoVersion: 3 }]);
  });
});
