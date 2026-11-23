// @vitest-environment jsdom
import { act } from "react";
import { QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";

import type { RoomScheduleItem } from "@/lib/api/rooms/schedule-items";
import { schedulePlanPlacesQueryOptions } from "@/lib/plan/scheduleItemPlaces";
import type { PlanPlace } from "@/lib/plan/types";
import { roomSchedulesQueryKey, scheduleItemsQueryKey } from "@/lib/query-keys";
import { placePreviewQueryKey } from "@/lib/places/place-queries";
import { hydrateRoomSchedulesFromServer } from "@/lib/rooms";
import type { RoomScheduleWithItems, RoomSchedule } from "@/lib/api/rooms/schedules";
import { dispatchRoomScheduleEvent } from "@/lib/stomp/schedules-dispatch";
import { hookHarness } from "@/test/hook-harness";

import {
  useDeleteScheduleItem,
  useMoveRoomSchedule,
  useMoveScheduleItemToSchedule,
  useReorderScheduleItem,
  useScheduleItemMoveSavingDays,
  useUpdateScheduleItemTravelMode,
} from "./useRooms";

const api = vi.hoisted(() => ({
  deleteScheduleItem: vi.fn(),
  updateScheduleItemTravelMode: vi.fn(),
  getScheduleItems: vi.fn(),
  getRoomSchedules: vi.fn(),
  reorderScheduleItem: vi.fn(),
  moveScheduleItemToSchedule: vi.fn(),
  moveRoomSchedule: vi.fn(),
}));
vi.mock("@/lib/client-env", () => ({
  clientEnv: { NEXT_PUBLIC_API_BASE_URL: "https://api.example.test" },
}));
vi.mock("@/lib/api/rooms/schedule-items", async (original) => ({
  ...(await original<object>()),
  deleteScheduleItem: api.deleteScheduleItem,
  updateScheduleItemTravelMode: api.updateScheduleItemTravelMode,
  getScheduleItems: api.getScheduleItems,
  reorderScheduleItem: api.reorderScheduleItem,
  moveScheduleItemToSchedule: api.moveScheduleItemToSchedule,
}));
vi.mock("@/lib/api/rooms/schedules", async (original) => ({
  ...(await original<object>()),
  moveRoomSchedule: api.moveRoomSchedule,
  getRoomSchedules: api.getRoomSchedules,
}));
vi.mock("@/lib/api/rooms", async (original) => ({
  ...(await original<object>()),
  getRoomDetail: vi.fn().mockRejectedValue(new Error("room detail unavailable")),
}));
vi.mock("@/contexts/StompContext", () => ({
  useStompContext: () => ({ connected: true }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const place = (itemId: number): PlanPlace => ({
  id: `item-${itemId}`,
  itemId,
  googlePlaceId: `g${itemId}`,
  title: `장소 ${itemId}`,
});
const items = (...itemIds: number[]): RoomScheduleItem[] =>
  itemIds.map((itemId, orderIndex) => ({
    itemId,
    scheduleId: 10,
    googlePlaceId: `g${itemId}`,
    startTime: null,
    endTime: null,
    orderIndex,
    travelMode: "DRIVING",
    createdAt: "",
  }));

function seedThreeScheduleDays(client: QueryClient) {
  const key = roomSchedulesQueryKey("room-1");
  const day = (scheduleId: number, dayNumber: number): RoomSchedule => ({
    scheduleId,
    roomId: "room-1",
    dayNumber,
    date: `2026-10-0${dayNumber}`,
    createdAt: "",
  });
  client.setQueryData(key, [day(10, 1), day(20, 2), day(30, 3)]);
  return key;
}

it("refetches the day after the user's own delete so an older in-flight refetch cannot bring the place back", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const key = scheduleItemsQueryKey("room-1", 10);
  client.setQueryData(key, [place(100), place(101)]);
  const unwatch = new QueryObserver(client, schedulePlanPlacesQueryOptions(client, "room-1", 10)).subscribe(() => {});
  let resolveBeforeDelete!: (rows: RoomScheduleItem[]) => void;
  api.getScheduleItems
    .mockReturnValueOnce(
      new Promise<RoomScheduleItem[]>((resolve) => {
        resolveBeforeDelete = resolve;
      }),
    )
    .mockResolvedValueOnce(items(100));
  api.deleteScheduleItem.mockResolvedValue(undefined);
  const hook = hookHarness(
    () => useDeleteScheduleItem(),
    (child) => <QueryClientProvider client={client}>{child}</QueryClientProvider>,
  );
  try {
    await hook.render(undefined);
    void client.invalidateQueries({ queryKey: key, exact: true });
    await act(async () => {
      await hook.current.mutateAsync({ roomId: "room-1", scheduleId: 10, itemId: 101 });
    });
    resolveBeforeDelete(items(100, 101));
    await hook.flush();

    expect(api.getScheduleItems).toHaveBeenCalledTimes(2);
    expect(client.getQueryData<PlanPlace[]>(key)?.map((p) => p.itemId)).toEqual([100]);
  } finally {
    unwatch();
    await hook.unmount();
    client.clear();
  }
});

const ids = (places: PlanPlace[] | undefined) => places?.map((p) => p.itemId);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function newClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

it.each(["GET last", "PATCH last", "later mode edit", "back to original mode"] as const)(
  "keeps the saved mode and concurrent server edits (%s)",
  async (order) => {
    const client = newClient();
    const key = scheduleItemsQueryKey("room-1", 10);
    client.setQueryData(key, [{ ...place(101), travelMode: "WALKING" }]);
    const unwatch = new QueryObserver(client, schedulePlanPlacesQueryOptions(client, "room-1", 10)).subscribe(() => {});
    const patch = deferred<RoomScheduleItem>();
    api.updateScheduleItemTravelMode.mockReturnValueOnce(patch.promise);
    const saved = items(101)[0];
    const remoteMode = order === "later mode edit" || order === "back to original mode";
    const travelMode = order === "back to original mode" ? "WALKING" : "TRANSIT";
    const latest = { ...saved, startTime: "11:30", travelMode: remoteMode ? travelMode : "DRIVING" };
    const day = deferred<RoomScheduleItem[]>();
    api.getScheduleItems.mockReset().mockReturnValueOnce(day.promise).mockResolvedValue([latest]);
    const hook = hookHarness(
      () => useUpdateScheduleItemTravelMode("room-1", 10, 101),
      (child) => <QueryClientProvider client={client}>{child}</QueryClientProvider>,
    );
    try {
      await hook.render(undefined);
      let saving!: Promise<RoomScheduleItem>;
      await act(async () => {
        saving = hook.current.mutateAsync("DRIVING");
      });
      await dispatchRoomScheduleEvent(client, {
        type: remoteMode ? "SCHEDULE_ITEM_TRAVEL_MODE_UPDATED" : "SCHEDULE_ITEM_UPDATED",
        roomId: "room-1",
        scheduleId: 10,
        itemId: 101,
        actorUserId: 2,
        scheduleIds: null,
        affectedRouteItemIds: [],
      });
      await vi.waitFor(() => expect(api.getScheduleItems).toHaveBeenCalledTimes(1));
      if (order !== "GET last") {
        day.resolve([latest]);
        await vi.waitFor(() => expect(client.getQueryData<PlanPlace[]>(key)?.[0].startTime).toBe("11:30"));
      }
      await act(async () => {
        patch.resolve(saved);
        await saving;
      });
      if (order === "GET last") {
        day.resolve([{ ...latest, travelMode: "WALKING" }]);
        await hook.flush();
      }
      expect(client.getQueryData<PlanPlace[]>(key)?.[0]).toMatchObject({
        travelMode: latest.travelMode,
        startTime: "11:30",
      });
      expect(api.getScheduleItems).toHaveBeenCalledTimes(order === "PATCH last" ? 1 : 2);
    } finally {
      unwatch();
      await hook.unmount();
      client.clear();
    }
  },
);

it("preserves an inactive day's remote invalidation across a mode save until the day reopens", async () => {
  const client = newClient();
  const key = scheduleItemsQueryKey("room-1", 10);
  client.setQueryData(
    key,
    [101, 103].map((id) => ({ ...place(id), travelMode: "WALKING" })),
  );
  const watch = () =>
    new QueryObserver(client, schedulePlanPlacesQueryOptions(client, "room-1", 10)).subscribe(() => {});
  let unwatch = watch();
  const patch = deferred<RoomScheduleItem>();
  api.updateScheduleItemTravelMode.mockReturnValueOnce(patch.promise);
  const [savedA, initialB] = items(101, 103);
  api.getScheduleItems
    .mockReset()
    .mockResolvedValue([savedA, { ...initialB, travelMode: "WALKING", startTime: "11:30" }]);
  const hook = hookHarness(
    () => useUpdateScheduleItemTravelMode("room-1", 10, 101),
    (child) => <QueryClientProvider client={client}>{child}</QueryClientProvider>,
  );
  try {
    await hook.render(undefined);
    let saving!: Promise<RoomScheduleItem>;
    await act(async () => {
      saving = hook.current.mutateAsync("DRIVING");
    });
    unwatch();
    await dispatchRoomScheduleEvent(client, {
      type: "SCHEDULE_ITEM_UPDATED",
      roomId: "room-1",
      scheduleId: 10,
      itemId: 103,
      actorUserId: 2,
      scheduleIds: null,
      affectedRouteItemIds: [],
    });
    await vi.waitFor(() => expect(client.getQueryState(key)?.isInvalidated).toBe(true));
    await act(async () => {
      patch.resolve(savedA);
      await saving;
    });
    expect(client.getQueryData<PlanPlace[]>(key)?.[0].travelMode).toBe("DRIVING");
    expect(api.getScheduleItems).not.toHaveBeenCalled();
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    unwatch = watch();
    await vi.waitFor(() => expect(client.getQueryData<PlanPlace[]>(key)?.[1].startTime).toBe("11:30"));
    expect(client.getQueryData<PlanPlace[]>(key)?.[0].travelMode).toBe("DRIVING");
    expect(api.getScheduleItems).toHaveBeenCalledTimes(1);
  } finally {
    unwatch();
    await hook.unmount();
    client.clear();
  }
});

it.each([
  { active: true, evicted: false, roomLast: true },
  { active: false, evicted: false, roomLast: true },
  { active: false, evicted: true, roomLast: true },
  { active: true, evicted: false, roomLast: false },
])(
  "reconciles room resync with a mode save (day active: $active, evicted: $evicted, room arrives last: $roomLast)",
  async ({ active, evicted, roomLast }) => {
    const client = newClient();
    const roomId = "room-1";
    const key = scheduleItemsQueryKey(roomId, 10);
    const roomKey = roomSchedulesQueryKey(roomId);
    const schedule = { scheduleId: 10, roomId, dayNumber: 1, date: "2026-11-23", createdAt: "" };
    client.setQueryData(roomKey, [schedule]);
    client.setQueryData(
      key,
      [101, 103].map((id) => ({ ...place(id), travelMode: "WALKING" })),
    );
    const watchDay = () =>
      new QueryObserver(client, schedulePlanPlacesQueryOptions(client, roomId, 10)).subscribe(() => {});
    let unwatchDay = watchDay();
    const unwatchRoom = new QueryObserver(client, {
      queryKey: roomKey,
      staleTime: Infinity,
      queryFn: ({ signal }) => hydrateRoomSchedulesFromServer(client, roomId, signal),
    }).subscribe(() => {});
    const roomRead = deferred<RoomScheduleWithItems[]>();
    const patch = deferred<RoomScheduleItem>();
    const [savedA, originalB] = items(101, 103);
    const changedB = { ...originalB, travelMode: "WALKING", startTime: "11:30" };
    const walkingA = { ...savedA, travelMode: "WALKING" };
    const roomSnapshot = [{ ...schedule, items: [walkingA, changedB] }];
    const finalA = roomLast ? savedA : walkingA;
    for (const place of [savedA, changedB]) {
      client.setQueryData(placePreviewQueryKey(place.googlePlaceId), { name: place.googlePlaceId });
    }
    api.getRoomSchedules
      .mockReset()
      .mockReturnValueOnce(roomRead.promise)
      .mockResolvedValueOnce([{ ...schedule, items: [savedA, changedB] }]);
    api.getScheduleItems.mockReset().mockResolvedValue([finalA, changedB]);
    api.updateScheduleItemTravelMode.mockReturnValueOnce(patch.promise);
    const hook = hookHarness(
      () => useUpdateScheduleItemTravelMode(roomId, 10, 101),
      (child) => <QueryClientProvider client={client}>{child}</QueryClientProvider>,
    );
    try {
      await hook.render(undefined);
      let saving!: Promise<RoomScheduleItem>;
      await act(async () => {
        saving = hook.current.mutateAsync("DRIVING");
      });
      if (!active) unwatchDay();
      if (evicted) client.removeQueries({ queryKey: key, exact: true });
      const resync = dispatchRoomScheduleEvent(client, {
        type: "ROOM_SCHEDULES_RESYNCED",
        roomId,
        actorUserId: 2,
        scheduleId: null,
        itemId: null,
        scheduleIds: null,
        affectedRouteItemIds: [],
      });
      await vi.waitFor(() => expect(api.getRoomSchedules).toHaveBeenCalledTimes(1));
      expect(client.isFetching({ queryKey: key, exact: true })).toBe(0);
      if (!roomLast) {
        roomRead.resolve(roomSnapshot);
        await resync;
      }
      await act(async () => {
        patch.resolve(savedA);
        await saving;
      });
      if (roomLast) {
        expect(client.getQueryData<PlanPlace[]>(key)?.[0].travelMode).toBe("DRIVING");
        roomRead.resolve(roomSnapshot);
        await resync;
        await hook.flush();
        expect(api.getRoomSchedules.mock.calls[0][1].signal.aborted).toBe(true);
      }
      expect(api.getRoomSchedules).toHaveBeenCalledTimes(roomLast ? 2 : 1);
      expect(client.getQueryData<RoomScheduleWithItems[]>(roomKey)?.[0].items).toEqual([finalA, changedB]);
      if (!active) unwatchDay = watchDay();
      expect(client.getQueryData<PlanPlace[]>(key)).toMatchObject([
        { itemId: 101, travelMode: finalA.travelMode },
        { itemId: 103, startTime: "11:30" },
      ]);
      expect(api.getScheduleItems).toHaveBeenCalledTimes(roomLast ? 0 : 1);
    } finally {
      unwatchDay();
      unwatchRoom();
      await hook.unmount();
      client.clear();
    }
  },
);

it("shows the new order before the reorder response and puts the previous list back when saving fails", async () => {
  const client = newClient();
  const key = scheduleItemsQueryKey("room-1", 10);
  client.setQueryData(key, [place(100), place(101), place(102)]);
  const reorder = deferred<RoomScheduleItem[]>();
  api.reorderScheduleItem.mockReturnValueOnce(reorder.promise);
  const hook = hookHarness(
    () => ({ reorder: useReorderScheduleItem(), savingDays: useScheduleItemMoveSavingDays("room-1") }),
    (child) => <QueryClientProvider client={client}>{child}</QueryClientProvider>,
  );
  try {
    await hook.render(undefined);
    let saving!: Promise<unknown>;
    await act(async () => {
      saving = hook.current.reorder
        .mutateAsync({ roomId: "room-1", scheduleId: 10, itemId: 102, body: { newOrderIndex: 0 } })
        .catch((error: unknown) => error);
    });
    await hook.flush();
    expect(ids(client.getQueryData<PlanPlace[]>(key))).toEqual([102, 100, 101]);
    expect(hook.current.savingDays).toEqual([10]);

    reorder.reject(new Error("저장 실패"));
    await act(async () => {
      await saving;
    });
    expect(ids(client.getQueryData<PlanPlace[]>(key))).toEqual([100, 101, 102]);
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    await hook.flush();
    expect(hook.current.savingDays).toEqual([]);
  } finally {
    await hook.unmount();
    client.clear();
  }
});

it("cancels an in-flight day refetch so its older list cannot overwrite the optimistic order", async () => {
  const client = newClient();
  const key = scheduleItemsQueryKey("room-1", 10);
  client.setQueryData(key, [place(100), place(101)]);
  const unwatch = new QueryObserver(client, schedulePlanPlacesQueryOptions(client, "room-1", 10)).subscribe(() => {});
  const olderFetch = deferred<RoomScheduleItem[]>();
  api.getScheduleItems.mockReturnValueOnce(olderFetch.promise).mockResolvedValue(items(101, 100));
  api.reorderScheduleItem.mockResolvedValueOnce(items(101, 100));
  const hook = hookHarness(
    () => useReorderScheduleItem(),
    (child) => <QueryClientProvider client={client}>{child}</QueryClientProvider>,
  );
  try {
    await hook.render(undefined);
    void client.invalidateQueries({ queryKey: key, exact: true });
    await act(async () => {
      await hook.current.mutateAsync({ roomId: "room-1", scheduleId: 10, itemId: 101, body: { newOrderIndex: 0 } });
    });
    olderFetch.resolve(items(100, 101));
    await hook.flush();
    expect(ids(client.getQueryData<PlanPlace[]>(key))).toEqual([101, 100]);
  } finally {
    unwatch();
    await hook.unmount();
    client.clear();
  }
});

it("moves the place out of the source day and into the target day before the response, and restores both when saving fails", async () => {
  const client = newClient();
  const sourceKey = scheduleItemsQueryKey("room-1", 10);
  const targetKey = scheduleItemsQueryKey("room-1", 20);
  client.setQueryData(sourceKey, [place(100), place(101)]);
  client.setQueryData(targetKey, [place(200)]);
  const move = deferred<unknown>();
  api.moveScheduleItemToSchedule.mockReturnValueOnce(move.promise);
  const hook = hookHarness(
    () => ({ move: useMoveScheduleItemToSchedule(), savingDays: useScheduleItemMoveSavingDays("room-1") }),
    (child) => <QueryClientProvider client={client}>{child}</QueryClientProvider>,
  );
  try {
    await hook.render(undefined);
    let saving!: Promise<unknown>;
    await act(async () => {
      saving = hook.current.move
        .mutateAsync({ roomId: "room-1", sourceScheduleId: 10, itemId: 101, targetScheduleId: 20, targetOrderIndex: 0 })
        .catch((error: unknown) => error);
    });
    await hook.flush();
    expect(ids(client.getQueryData<PlanPlace[]>(sourceKey))).toEqual([100]);
    expect(ids(client.getQueryData<PlanPlace[]>(targetKey))).toEqual([101, 200]);
    expect(hook.current.savingDays.sort()).toEqual([10, 20]);

    move.reject(new Error("저장 실패"));
    await act(async () => {
      await saving;
    });
    expect(ids(client.getQueryData<PlanPlace[]>(sourceKey))).toEqual([100, 101]);
    expect(ids(client.getQueryData<PlanPlace[]>(targetKey))).toEqual([200]);
    expect(client.getQueryState(sourceKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(targetKey)?.isInvalidated).toBe(true);
  } finally {
    await hook.unmount();
    client.clear();
  }
});

it("keeps a saved cross-day move as saved even when the follow-up day refetch fails", async () => {
  const client = newClient();
  const sourceKey = scheduleItemsQueryKey("room-1", 10);
  const targetKey = scheduleItemsQueryKey("room-1", 20);
  client.setQueryData(sourceKey, [place(100), place(101)]);
  client.setQueryData(targetKey, [place(200)]);
  const unwatch = [10, 20].map((scheduleId) =>
    new QueryObserver(client, schedulePlanPlacesQueryOptions(client, "room-1", scheduleId)).subscribe(() => {}),
  );
  api.moveScheduleItemToSchedule.mockResolvedValueOnce({});
  api.getScheduleItems.mockRejectedValue(new Error("조회 실패"));
  const hook = hookHarness(
    () => useMoveScheduleItemToSchedule(),
    (child) => <QueryClientProvider client={client}>{child}</QueryClientProvider>,
  );
  try {
    await hook.render(undefined);
    await act(async () => {
      await hook.current.mutateAsync({
        roomId: "room-1",
        sourceScheduleId: 10,
        itemId: 101,
        targetScheduleId: 20,
        targetOrderIndex: 1,
      });
    });
    expect(ids(client.getQueryData<PlanPlace[]>(sourceKey))).toEqual([100]);
    expect(ids(client.getQueryData<PlanPlace[]>(targetKey))).toEqual([200, 101]);
  } finally {
    unwatch.forEach((stop) => stop());
    await hook.unmount();
    client.clear();
  }
});

it("moves the day and renumbers day numbers and dates before the response, and restores them when saving fails", async () => {
  const client = newClient();
  const key = seedThreeScheduleDays(client);
  const move = deferred<unknown>();
  api.moveRoomSchedule.mockReturnValueOnce(move.promise);
  const hook = hookHarness(
    () => useMoveRoomSchedule(),
    (child) => <QueryClientProvider client={client}>{child}</QueryClientProvider>,
  );
  const shown = () => client.getQueryData<RoomSchedule[]>(key)?.map((s) => [s.scheduleId, s.dayNumber, s.date]);
  try {
    await hook.render(undefined);
    let saving!: Promise<unknown>;
    await act(async () => {
      saving = hook.current
        .mutateAsync({ roomId: "room-1", scheduleId: 30, targetDayNumber: 1 })
        .catch((error: unknown) => error);
    });
    await hook.flush();
    expect(shown()).toEqual([
      [30, 1, "2026-10-01"],
      [10, 2, "2026-10-02"],
      [20, 3, "2026-10-03"],
    ]);

    move.reject(new Error("저장 실패"));
    await act(async () => {
      await saving;
    });
    expect(shown()).toEqual([
      [10, 1, "2026-10-01"],
      [20, 2, "2026-10-02"],
      [30, 3, "2026-10-03"],
    ]);
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  } finally {
    await hook.unmount();
    client.clear();
  }
});

it("draws only the latest order when two reorders on the same day overlap, and refetches the day once after the last save", async () => {
  const client = newClient();
  const key = scheduleItemsQueryKey("room-1", 10);
  client.setQueryData(key, [place(100), place(101), place(102)]);
  const unwatch = new QueryObserver(client, schedulePlanPlacesQueryOptions(client, "room-1", 10)).subscribe(() => {});
  const first = deferred<RoomScheduleItem[]>();
  const second = deferred<RoomScheduleItem[]>();
  api.reorderScheduleItem.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  api.getScheduleItems.mockReset().mockResolvedValue(items(102, 100, 101));
  const hook = hookHarness(
    () => useReorderScheduleItem(),
    (child) => <QueryClientProvider client={client}>{child}</QueryClientProvider>,
  );
  try {
    await hook.render(undefined);
    let firstSaving!: Promise<unknown>;
    let secondSaving!: Promise<unknown>;
    await act(async () => {
      firstSaving = hook.current.mutateAsync({
        roomId: "room-1",
        scheduleId: 10,
        itemId: 100,
        body: { newOrderIndex: 2 },
      });
    });
    await hook.flush();
    await act(async () => {
      secondSaving = hook.current.mutateAsync({
        roomId: "room-1",
        scheduleId: 10,
        itemId: 101,
        body: { newOrderIndex: 2 },
      });
    });
    await hook.flush();
    expect(ids(client.getQueryData<PlanPlace[]>(key))).toEqual([102, 100, 101]);

    await act(async () => {
      first.resolve(items(101, 102, 100));
      await firstSaving;
    });
    await hook.flush();
    expect(ids(client.getQueryData<PlanPlace[]>(key))).toEqual([102, 100, 101]);
    expect(api.getScheduleItems).not.toHaveBeenCalled();

    await act(async () => {
      second.resolve(items(102, 100, 101));
      await secondSaving;
    });
    await hook.flush();
    expect(api.getScheduleItems).toHaveBeenCalledTimes(1);
    expect(ids(client.getQueryData<PlanPlace[]>(key))).toEqual([102, 100, 101]);
  } finally {
    unwatch();
    await hook.unmount();
    client.clear();
  }
});

it("refetches the room schedules once, after the last of two overlapping day moves", async () => {
  const client = newClient();
  const key = seedThreeScheduleDays(client);
  const first = deferred<unknown>();
  const second = deferred<unknown>();
  api.moveRoomSchedule.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const hook = hookHarness(
    () => useMoveRoomSchedule(),
    (child) => <QueryClientProvider client={client}>{child}</QueryClientProvider>,
  );
  try {
    await hook.render(undefined);
    let firstSaving!: Promise<unknown>;
    let secondSaving!: Promise<unknown>;
    await act(async () => {
      firstSaving = hook.current.mutateAsync({ roomId: "room-1", scheduleId: 30, targetDayNumber: 1 });
      secondSaving = hook.current.mutateAsync({ roomId: "room-1", scheduleId: 10, targetDayNumber: 3 });
    });
    await hook.flush();

    await act(async () => {
      first.resolve({});
      await firstSaving;
    });
    expect(client.getQueryState(key)?.isInvalidated).toBe(false);

    await act(async () => {
      second.resolve({});
      await secondSaving;
    });
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  } finally {
    await hook.unmount();
    client.clear();
  }
});

it("rejects a failed reorder right away without waiting for the day refetch, so the failure toast is not late", async () => {
  const client = newClient();
  const key = scheduleItemsQueryKey("room-1", 10);
  client.setQueryData(key, [place(100), place(101)]);
  const unwatch = new QueryObserver(client, schedulePlanPlacesQueryOptions(client, "room-1", 10)).subscribe(() => {});
  api.reorderScheduleItem.mockRejectedValueOnce(new Error("저장 실패"));
  api.getScheduleItems.mockReset().mockReturnValue(new Promise<RoomScheduleItem[]>(() => {}));
  const hook = hookHarness(
    () => useReorderScheduleItem(),
    (child) => <QueryClientProvider client={client}>{child}</QueryClientProvider>,
  );
  try {
    await hook.render(undefined);
    await act(async () => {
      await expect(
        hook.current.mutateAsync({ roomId: "room-1", scheduleId: 10, itemId: 101, body: { newOrderIndex: 0 } }),
      ).rejects.toThrow("저장 실패");
    });
    expect(ids(client.getQueryData<PlanPlace[]>(key))).toEqual([100, 101]);
    expect(api.getScheduleItems).toHaveBeenCalledTimes(1);
  } finally {
    unwatch();
    await hook.unmount();
    client.clear();
  }
});
