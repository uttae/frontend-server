import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RoomScheduleWithItems } from "@/lib/api/rooms/schedules";
import type { PlanPlace } from "@/lib/plan/types";
import { roomSchedulesQueryKey, scheduleItemsQueryKey } from "@/lib/query-keys";

const mocks = vi.hoisted(() => ({
  getRoomSchedules: vi.fn(),
  build: vi.fn(),
}));

vi.mock("@/lib/api/rooms", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getRoomSchedules: mocks.getRoomSchedules,
}));
vi.mock("@/lib/plan/schedule-bulk-hydration", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  buildSchedulePlacesFromSchedulesWithItems: mocks.build,
}));

import { hydrateRoomSchedulesFromServer, refreshRoomSchedules } from "@/lib/rooms";

const ROOM_ID = "room-1";
const SERVER_SCHEDULES: RoomScheduleWithItems[] = [
  { scheduleId: 1, roomId: ROOM_ID, dayNumber: 1, date: "2026-10-25", createdAt: "", items: [] },
];
const SERVER_PLACES: PlanPlace[] = [{ id: "item-7", itemId: 7, title: "B" }];
const CACHED_PLACES: PlanPlace[] = [{ id: "item-5", itemId: 5, title: "A" }];

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("hydrateRoomSchedulesFromServer", () => {
  it("does not overwrite caches with a snapshot whose fetch was cancelled", async () => {
    const client = new QueryClient();
    client.setQueryData(scheduleItemsQueryKey(ROOM_ID, 1), CACHED_PLACES);
    const response = deferred<RoomScheduleWithItems[]>();
    mocks.getRoomSchedules.mockReturnValueOnce(response.promise);
    mocks.build.mockResolvedValueOnce(new Map([[1, SERVER_PLACES]]));
    const controller = new AbortController();

    const pending = hydrateRoomSchedulesFromServer(client, ROOM_ID, controller.signal);
    controller.abort();
    response.resolve(SERVER_SCHEDULES);
    await pending;

    expect(client.getQueryData(scheduleItemsQueryKey(ROOM_ID, 1))).toBe(CACHED_PLACES);
    expect(client.getQueryData(roomSchedulesQueryKey(ROOM_ID))).toBeUndefined();
    client.clear();
  });

  it("writes the day lists once the snapshot is current", async () => {
    const client = new QueryClient();
    mocks.getRoomSchedules.mockResolvedValueOnce(SERVER_SCHEDULES);
    mocks.build.mockResolvedValueOnce(new Map([[1, SERVER_PLACES]]));

    await hydrateRoomSchedulesFromServer(client, ROOM_ID, new AbortController().signal);

    expect(client.getQueryData(scheduleItemsQueryKey(ROOM_ID, 1))).toEqual(SERVER_PLACES);
    expect(client.getQueryData(roomSchedulesQueryKey(ROOM_ID))).toEqual(SERVER_SCHEDULES);
    client.clear();
  });
});

describe("refreshRoomSchedules", () => {
  it("cancels an in-flight snapshot so only the refresh started after the change is written", async () => {
    const client = new QueryClient();
    const stale = deferred<RoomScheduleWithItems[]>();
    mocks.getRoomSchedules
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce(SERVER_SCHEDULES);
    mocks.build.mockResolvedValue(new Map([[1, SERVER_PLACES]]));
    const staleFetch = client
      .fetchQuery({
        queryKey: roomSchedulesQueryKey(ROOM_ID),
        queryFn: ({ signal }) => hydrateRoomSchedulesFromServer(client, ROOM_ID, signal),
      })
      .catch(() => null);

    await refreshRoomSchedules(client, ROOM_ID);
    stale.resolve([]);
    await staleFetch;

    expect(client.getQueryData(roomSchedulesQueryKey(ROOM_ID))).toEqual(SERVER_SCHEDULES);
    expect(client.getQueryData(scheduleItemsQueryKey(ROOM_ID, 1))).toEqual(SERVER_PLACES);
    client.clear();
  });
});
