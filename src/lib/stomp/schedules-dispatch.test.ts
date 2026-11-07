import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { scheduleItemRouteQueryKey, sessionUserQueryKey } from "@/lib/query-keys";

import type { RoomScheduleChangedEvent } from "@/lib/stomp/schedule-events";

const mocks = vi.hoisted(() => ({
  invalidateSchedulePlanPlaces: vi.fn(),
  syncAfterCrossScheduleItemMove: vi.fn(),
  syncRoomDetailFromServer: vi.fn(),
}));

vi.mock("@/lib/plan/scheduleItemPlaces", () => ({
  invalidateSchedulePlanPlaces: mocks.invalidateSchedulePlanPlaces,
  syncAfterCrossScheduleItemMove: mocks.syncAfterCrossScheduleItemMove,
}));

vi.mock("@/lib/rooms", () => ({
  syncRoomDetailFromServer: mocks.syncRoomDetailFromServer,
}));

vi.mock("@/lib/tab-id", () => ({ getTabId: () => "tab-a" }));
const MY_TAB_ID = "tab-a";

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
  // 경로는 도착 항목까지 key에 있어 일정이 바뀌어도 무효화하지 않는다 — 순서가 바뀐 구간은 새 key로 받는다
  const routeKey = scheduleItemRouteQueryKey("room-1", 10, 20, 21, "DRIVING");

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

  it("refetches consecutive ID-only time updates once", async () => {
    vi.useFakeTimers();
    const event = itemEvent("SCHEDULE_ITEM_UPDATED", []);
    await dispatchRoomScheduleEvent(queryClient, event);
    await dispatchRoomScheduleEvent(queryClient, event);
    await vi.runAllTimersAsync();

    expect(mocks.invalidateSchedulePlanPlaces).toHaveBeenCalledExactlyOnceWith(queryClient, "room-1", 10);
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

    expect(mocks.invalidateSchedulePlanPlaces).toHaveBeenCalledExactlyOnceWith(queryClient, "room-1", 10);
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

describe("echo of this tab vs. other tabs of the same account", () => {
  const SKIPPABLE_TYPES = [
    "ROOM_SCHEDULES_RESYNCED",
    "SCHEDULE_ITEM_MOVED",
    "SCHEDULE_ITEM_DELETED",
    "SCHEDULE_ITEM_CREATED",
    "SCHEDULE_ITEMS_REORDERED",
    "SCHEDULE_ITEM_TRAVEL_MODE_UPDATED",
  ] as const;
  let queryClient: QueryClient;

  /** itemEvent의 actorUserId(99)가 이 계정이다 */
  function ownAccountEvent(
    type: RoomScheduleChangedEvent["type"],
    originTabId: string | null,
  ): RoomScheduleChangedEvent {
    return { ...itemEvent(type, [20]), scheduleIds: [10, 11], originTabId };
  }

  /** 일차 목록·일정 전체·방 상세 중 어느 것이든 다시 받은 횟수 */
  const refetchCount = () =>
    mocks.invalidateSchedulePlanPlaces.mock.calls.length +
    mocks.syncAfterCrossScheduleItemMove.mock.calls.length +
    mocks.syncRoomDetailFromServer.mock.calls.length;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.invalidateSchedulePlanPlaces.mockResolvedValue(undefined);
    mocks.syncAfterCrossScheduleItemMove.mockResolvedValue(undefined);
    queryClient = new QueryClient();
    queryClient.setQueryData(sessionUserQueryKey, { id: 99 });
  });

  afterEach(() => {
    vi.useRealTimers();
    queryClient.clear();
  });

  it.each(SKIPPABLE_TYPES)("skips %s sent from this tab", async (type) => {
    await dispatchRoomScheduleEvent(queryClient, ownAccountEvent(type, MY_TAB_ID));
    await vi.runAllTimersAsync();

    expect(refetchCount()).toBe(0);
  });

  it.each(SKIPPABLE_TYPES)("applies %s sent from another tab of the same account", async (type) => {
    await dispatchRoomScheduleEvent(queryClient, ownAccountEvent(type, "tab-b"));
    await vi.runAllTimersAsync();

    expect(refetchCount()).toBe(1);
  });

  it.each(SKIPPABLE_TYPES)("applies %s of the same account without a tab ID — it may come from another tab", async (type) => {
    await dispatchRoomScheduleEvent(queryClient, ownAccountEvent(type, null));
    await vi.runAllTimersAsync();

    expect(refetchCount()).toBe(1);
  });

  it("skips a time update sent from this tab — its own settled refetch already has it", async () => {
    await dispatchRoomScheduleEvent(queryClient, ownAccountEvent("SCHEDULE_ITEM_UPDATED", MY_TAB_ID));
    await vi.runAllTimersAsync();

    expect(mocks.invalidateSchedulePlanPlaces).not.toHaveBeenCalled();
  });

  it.each(["tab-b", null])("refetches a time update of the same account from another tab (%s)", async (originTabId) => {
    await dispatchRoomScheduleEvent(queryClient, ownAccountEvent("SCHEDULE_ITEM_UPDATED", originTabId));
    await vi.runAllTimersAsync();

    expect(mocks.invalidateSchedulePlanPlaces).toHaveBeenCalledExactlyOnceWith(queryClient, "room-1", 10);
  });
});
