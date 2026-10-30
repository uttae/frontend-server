import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RoomScheduleItem } from "@/lib/api/rooms/schedule-items";
import type { PlanPlace } from "@/lib/plan/types";
import { roomSchedulesQueryKey, scheduleItemsQueryKey } from "@/lib/query-keys";
import type { RoomScheduleChangedEvent } from "@/lib/stomp/schedule-events";

const fixtures = vi.hoisted(() => ({
  getScheduleItems: vi.fn(),
  place: (itemId: number) => ({
    id: `item-${itemId}`,
    itemId,
    googlePlaceId: `g${itemId}`,
    title: `장소 ${itemId}`,
  }),
}));

vi.mock("@/lib/api/rooms/schedule-items", () => ({
  getScheduleItems: fixtures.getScheduleItems,
}));
vi.mock("@/lib/places/place-queries", () => ({
  fetchPlacePreview: async (googlePlaceId: string) => ({
    name: googlePlaceId,
    formattedAddress: "",
  }),
}));
vi.mock("@/lib/plan/schedule-bulk-hydration", () => ({
  buildPlanPlacesFromItemsWithPreviewEnrichment: async (
    _queryClient: unknown,
    items: RoomScheduleItem[],
  ) =>
    [...items]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((item) => fixtures.place(item.itemId)),
  resolveScheduleItemsFromCacheOrHydrate: vi.fn(),
}));
vi.mock("@/lib/plan/scheduleStompRouteScope", () => ({
  bumpPlanMapRouteSegments: vi.fn(),
  invalidateScheduleItemRouteForSources: vi.fn(async () => undefined),
  invalidateScheduleItemRouteForWholeSchedule: vi.fn(async () => undefined),
  invalidateScheduleItemRoutesAfterDelete: vi.fn(async () => undefined),
  invalidateScheduleItemRoutesAfterItemCreated: vi.fn(async () => undefined),
  invalidateScheduleItemRoutesAfterReorder: vi.fn(async () => undefined),
  readOrderedItemIdsFromScheduleItemsCache: vi.fn(() => null),
  removeRouteQueriesForDeletedItemSource: vi.fn(),
}));
vi.mock("@/lib/rooms", () => ({
  syncRoomDetailFromServer: vi.fn(),
}));
vi.mock("@/lib/query-client", () => ({
  getQueryClient: () => null,
}));
vi.mock("@/stores/plan-map-directions-epoch-store", () => ({
  usePlanMapDirectionsEpochStore: {
    getState: () => ({ bumpForDirections: vi.fn(), bumpSegments: vi.fn() }),
  },
}));

import {
  removeScheduleItemFromPlanPlacesCache,
  schedulePlanPlacesQueryOptions,
} from "@/lib/plan/scheduleItemPlaces";
import { dispatchRoomScheduleEvent } from "@/lib/stomp/schedules-dispatch";

const ROOM_ID = "room-1";
const SCHEDULE_ID = 10;
const DAY_KEY = scheduleItemsQueryKey(ROOM_ID, SCHEDULE_ID);

/** 서버가 돌려주는 일차 항목 — 넘긴 순서가 곧 `orderIndex` */
const items = (...itemIds: number[]): RoomScheduleItem[] =>
  itemIds.map((itemId, orderIndex) => ({
    itemId,
    scheduleId: SCHEDULE_ID,
    googlePlaceId: `g${itemId}`,
    startTime: null,
    endTime: null,
    orderIndex,
    travelMode: "DRIVING",
    createdAt: "",
  }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** 늦게 도착한 응답이 캐시에 쓸 기회를 준다 */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function remoteEvent(
  type: RoomScheduleChangedEvent["type"],
  itemId: number,
): RoomScheduleChangedEvent {
  return {
    roomId: ROOM_ID,
    actorUserId: 2,
    type,
    scheduleId: SCHEDULE_ID,
    itemId,
    affectedRouteItemIds: [],
    scheduleIds: null,
  };
}

describe("schedule day list refetch order", () => {
  let client: QueryClient;
  let unwatch: () => void;

  // 일정 화면처럼 일차 목록을 보고 있는 구독자 — 무효화되면 바로 다시 받는다
  const watchDayList = () => {
    unwatch = new QueryObserver(
      client,
      schedulePlanPlacesQueryOptions(client, ROOM_ID, SCHEDULE_ID),
    ).subscribe(() => {});
  };
  const dayItemIds = () =>
    client.getQueryData<PlanPlace[]>(DAY_KEY)?.map((place) => place.itemId);

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    unwatch = () => {};
    fixtures.getScheduleItems.mockReset();
  });

  afterEach(() => {
    unwatch();
    client.clear();
  });

  it("keeps the latest order when the refetch for an earlier reorder answers last", async () => {
    client.setQueryData(DAY_KEY, [100, 101, 102].map(fixtures.place));
    watchDayList();
    const afterFirstReorder = deferred<RoomScheduleItem[]>();
    const afterSecondReorder = deferred<RoomScheduleItem[]>();
    fixtures.getScheduleItems
      .mockReturnValueOnce(afterFirstReorder.promise)
      .mockReturnValueOnce(afterSecondReorder.promise);

    const first = dispatchRoomScheduleEvent(
      client,
      remoteEvent("SCHEDULE_ITEMS_REORDERED", 101),
    );
    const second = dispatchRoomScheduleEvent(
      client,
      remoteEvent("SCHEDULE_ITEMS_REORDERED", 100),
    );
    await vi.waitFor(() =>
      expect(fixtures.getScheduleItems).toHaveBeenCalledTimes(2),
    );
    afterSecondReorder.resolve(items(101, 102, 100));
    afterFirstReorder.resolve(items(101, 100, 102));
    await Promise.all([first, second]);
    await settle();

    expect(dayItemIds()).toEqual([101, 102, 100]);
    // 앞선 조회는 취소되면서 요청도 끊긴다
    const firstSignal = fixtures.getScheduleItems.mock.calls[0]?.[2] as AbortSignal;
    expect(firstSignal.aborted).toBe(true);
  });

  it("does not bring back a place deleted while the refetch for its creation was slow", async () => {
    client.setQueryData(DAY_KEY, [100, 101, 102].map(fixtures.place));
    watchDayList();
    const afterCreate = deferred<RoomScheduleItem[]>();
    const afterDelete = deferred<RoomScheduleItem[]>();
    fixtures.getScheduleItems
      .mockReturnValueOnce(afterCreate.promise)
      .mockReturnValueOnce(afterDelete.promise);

    const created = dispatchRoomScheduleEvent(
      client,
      remoteEvent("SCHEDULE_ITEM_CREATED", 103),
    );
    const deleted = dispatchRoomScheduleEvent(
      client,
      remoteEvent("SCHEDULE_ITEM_DELETED", 103),
    );
    await vi.waitFor(() =>
      expect(fixtures.getScheduleItems).toHaveBeenCalledTimes(2),
    );
    afterDelete.resolve(items(100, 101, 102));
    afterCreate.resolve(items(100, 101, 102, 103));
    await Promise.all([created, deleted]);
    await settle();

    expect(dayItemIds()).toEqual([100, 101, 102]);
  });

  it("restarts a first load that was sent before the event", async () => {
    const beforeReorder = deferred<RoomScheduleItem[]>();
    fixtures.getScheduleItems
      .mockReturnValueOnce(beforeReorder.promise)
      .mockResolvedValueOnce(items(101, 100));
    watchDayList();
    await vi.waitFor(() =>
      expect(fixtures.getScheduleItems).toHaveBeenCalledOnce(),
    );

    await dispatchRoomScheduleEvent(
      client,
      remoteEvent("SCHEDULE_ITEMS_REORDERED", 101),
    );
    beforeReorder.resolve(items(100, 101));
    await settle();

    expect(fixtures.getScheduleItems).toHaveBeenCalledTimes(2);
    expect(dayItemIds()).toEqual([101, 100]);
  });

  it("keeps the user's delete when the mutation's settled refetch replaces an older in-flight refetch", async () => {
    client.setQueryData(DAY_KEY, [100, 101].map(fixtures.place));
    watchDayList();
    const beforeDelete = deferred<RoomScheduleItem[]>();
    fixtures.getScheduleItems
      .mockReturnValueOnce(beforeDelete.promise)
      .mockResolvedValueOnce(items(100));

    // 다른 사람의 변경으로 다시 받는 중에 본인 삭제 응답이 들어온다(useDeleteScheduleItem의 onSuccess → onSettled)
    void client.invalidateQueries({ queryKey: DAY_KEY, exact: true });
    removeScheduleItemFromPlanPlacesCache(client, ROOM_ID, SCHEDULE_ID, 101);
    await client.invalidateQueries({ queryKey: DAY_KEY, exact: true });
    beforeDelete.resolve(items(100, 101));
    await settle();

    expect(fixtures.getScheduleItems).toHaveBeenCalledTimes(2);
    expect(dayItemIds()).toEqual([100]);
  });

  it("refetches a garbage-collected day list instead of rebuilding it from the whole-room copy", async () => {
    // 101을 지우기 전에 받아 둔 일정 전체 — 일차 목록이 gc된 뒤에도 남아 있다
    client.setQueryData(roomSchedulesQueryKey(ROOM_ID), [
      {
        scheduleId: SCHEDULE_ID,
        roomId: ROOM_ID,
        dayNumber: 1,
        date: "2026-10-28",
        createdAt: "",
        items: items(100, 101, 102),
      },
    ]);
    fixtures.getScheduleItems.mockResolvedValue(items(100, 102));

    watchDayList();

    await vi.waitFor(() => expect(dayItemIds()).toEqual([100, 102]));
    expect(fixtures.getScheduleItems).toHaveBeenCalledOnce();
  });

  it("fetches from the server when the day list is invalidated", async () => {
    client.setQueryData(DAY_KEY, [100, 102].map(fixtures.place));
    watchDayList();
    fixtures.getScheduleItems.mockResolvedValue(items(100, 102, 103));

    await client.invalidateQueries({
      queryKey: DAY_KEY,
      exact: true,
      refetchType: "active",
    });

    expect(dayItemIds()).toEqual([100, 102, 103]);
  });
});
