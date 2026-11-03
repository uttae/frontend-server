import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { scheduleItemRouteQueryKey, sessionUserQueryKey } from "@/lib/query-keys";

import type { RoomScheduleChangedEvent } from "@/lib/stomp/schedule-events";

const mocks = vi.hoisted(() => ({
  invalidateSchedulePlanPlaces: vi.fn(),
  syncAfterCrossScheduleItemMove: vi.fn(),
}));

vi.mock("@/lib/plan/scheduleItemPlaces", () => ({
  invalidateSchedulePlanPlaces: mocks.invalidateSchedulePlanPlaces,
  syncAfterCrossScheduleItemMove: mocks.syncAfterCrossScheduleItemMove,
}));

vi.mock("@/lib/rooms", () => ({
  syncRoomDetailFromServer: vi.fn(),
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
  // 경로는 도착 장소까지 key에 있어 일정이 바뀌어도 무효화하지 않는다 — 순서가 바뀐 구간은 새 key로 받는다
  const routeKey = scheduleItemRouteQueryKey("room-1", 10, 20, "place-b", "DRIVING");

  beforeEach(() => {
    queryClient = new QueryClient();
    queryClient.setQueryData(routeKey, { travelMode: "DRIVING", distanceMeters: 100, durationSeconds: 60 });
    vi.clearAllMocks();
    mocks.invalidateSchedulePlanPlaces.mockResolvedValue(undefined);
    mocks.syncAfterCrossScheduleItemMove.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    queryClient.clear();
  });

  it.each([false, true])("refetches ID-only time updates, including own-user tabs (%s)", async (ownUser) => {
    vi.useFakeTimers();
    if (ownUser) queryClient.setQueryData(sessionUserQueryKey, { id: 99 });
    const event = itemEvent("SCHEDULE_ITEM_UPDATED", []);
    await dispatchRoomScheduleEvent(queryClient, event);
    await dispatchRoomScheduleEvent(queryClient, event);
    await vi.runAllTimersAsync();
    // 본인 반향만 모였으면 본인 저장이 끝나며 다시 받는 조회에 합류한다
    expect(mocks.invalidateSchedulePlanPlaces).toHaveBeenCalledExactlyOnceWith(queryClient, "room-1", 10, {
      joinInFlight: ownUser,
    });
    expect(queryClient.getQueryState(routeKey)?.isInvalidated).toBe(false);
  });

  it.each(["SCHEDULE_ITEM_CREATED", "SCHEDULE_ITEM_DELETED", "SCHEDULE_ITEMS_REORDERED"] as const)(
    "refetches the day list without invalidating route caches for %s",
    async (type) => {
      await dispatchRoomScheduleEvent(queryClient, itemEvent(type, [20]));

      expect(mocks.invalidateSchedulePlanPlaces).toHaveBeenCalledExactlyOnceWith(queryClient, "room-1", 10);
      expect(queryClient.getQueryState(routeKey)?.isInvalidated).toBe(false);
    },
  );

  it("refetches both days after a cross-schedule move", async () => {
    const event = itemEvent("SCHEDULE_ITEM_MOVED", [11, 21, 20]);
    event.scheduleId = 20;
    event.scheduleIds = [10, 20];

    await dispatchRoomScheduleEvent(queryClient, event);

    expect(mocks.syncAfterCrossScheduleItemMove).toHaveBeenCalledWith(
      queryClient,
      "room-1",
      10,
      20,
    );
    expect(queryClient.getQueryState(routeKey)?.isInvalidated).toBe(false);
  });

  it("refetches the day list after another member changes a travel mode, leaving route caches as they are", async () => {
    vi.useFakeTimers();

    await dispatchRoomScheduleEvent(
      queryClient,
      itemEvent("SCHEDULE_ITEM_TRAVEL_MODE_UPDATED", [20]),
    );
    await vi.runAllTimersAsync();

    expect(mocks.invalidateSchedulePlanPlaces).toHaveBeenCalledExactlyOnceWith(queryClient, "room-1", 10, {
      joinInFlight: false,
    });
    expect(queryClient.getQueryState(routeKey)?.isInvalidated).toBe(false);
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
