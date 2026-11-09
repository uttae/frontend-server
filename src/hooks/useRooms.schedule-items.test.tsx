// @vitest-environment jsdom
import { act } from "react";
import {
  QueryClient,
  QueryClientProvider,
  QueryObserver,
} from "@tanstack/react-query";
import { expect, it, vi } from "vitest";

import type { RoomScheduleItem } from "@/lib/api/rooms/schedule-items";
import { schedulePlanPlacesQueryOptions } from "@/lib/plan/scheduleItemPlaces";
import type { PlanPlace } from "@/lib/plan/types";
import { scheduleItemsQueryKey } from "@/lib/query-keys";
import { hookHarness } from "@/test/hook-harness";

import {
  useDeleteScheduleItem,
  useMoveScheduleItemToSchedule,
  useReorderScheduleItem,
} from "./useRooms";

const api = vi.hoisted(() => ({
  deleteScheduleItem: vi.fn(),
  getScheduleItems: vi.fn(),
  reorderScheduleItem: vi.fn(),
  moveScheduleItemToSchedule: vi.fn(),
}));
vi.mock("@/lib/client-env", () => ({
  clientEnv: { NEXT_PUBLIC_API_BASE_URL: "https://api.example.test" },
}));
vi.mock("@/lib/api/rooms/schedule-items", async (original) => ({
  ...(await original<object>()),
  deleteScheduleItem: api.deleteScheduleItem,
  getScheduleItems: api.getScheduleItems,
  reorderScheduleItem: api.reorderScheduleItem,
  moveScheduleItemToSchedule: api.moveScheduleItemToSchedule,
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

it("refetches the day after the user's own delete so an older in-flight refetch cannot bring the place back", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const key = scheduleItemsQueryKey("room-1", 10);
  client.setQueryData(key, [place(100), place(101)]);
  // 일정 화면처럼 일차 목록을 보고 있는 구독자
  const unwatch = new QueryObserver(
    client,
    schedulePlanPlacesQueryOptions(client, "room-1", 10),
  ).subscribe(() => {});
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
    // 다른 사람의 변경으로 일차를 다시 받는 중에 본인이 101을 지운다
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

it("shows the new order before the reorder response and puts the previous list back when saving fails", async () => {
  const client = newClient();
  const key = scheduleItemsQueryKey("room-1", 10);
  client.setQueryData(key, [place(100), place(101), place(102)]);
  const reorder = deferred<RoomScheduleItem[]>();
  api.reorderScheduleItem.mockReturnValueOnce(reorder.promise);
  const hook = hookHarness(
    () => useReorderScheduleItem(),
    (child) => <QueryClientProvider client={client}>{child}</QueryClientProvider>,
  );
  try {
    await hook.render(undefined);
    let saving!: Promise<unknown>;
    await act(async () => {
      saving = hook.current
        .mutateAsync({ roomId: "room-1", scheduleId: 10, itemId: 102, body: { newOrderIndex: 0 } })
        .catch((error: unknown) => error);
    });
    await hook.flush();
    // 응답 전 — 캐시가 이미 새 순서다
    expect(ids(client.getQueryData<PlanPlace[]>(key))).toEqual([102, 100, 101]);

    reorder.reject(new Error("저장 실패"));
    await act(async () => {
      await saving;
    });
    expect(ids(client.getQueryData<PlanPlace[]>(key))).toEqual([100, 101, 102]);
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  } finally {
    await hook.unmount();
    client.clear();
  }
});

it("cancels an in-flight day refetch so its older list cannot overwrite the optimistic order", async () => {
  const client = newClient();
  const key = scheduleItemsQueryKey("room-1", 10);
  client.setQueryData(key, [place(100), place(101)]);
  const unwatch = new QueryObserver(
    client,
    schedulePlanPlacesQueryOptions(client, "room-1", 10),
  ).subscribe(() => {});
  const olderFetch = deferred<RoomScheduleItem[]>();
  api.getScheduleItems
    .mockReturnValueOnce(olderFetch.promise)
    .mockResolvedValue(items(101, 100));
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
    // 취소된 옛 조회가 늦게 끝나도 캐시를 덮지 않는다
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
    () => useMoveScheduleItemToSchedule(),
    (child) => <QueryClientProvider client={client}>{child}</QueryClientProvider>,
  );
  try {
    await hook.render(undefined);
    let saving!: Promise<unknown>;
    await act(async () => {
      saving = hook.current
        .mutateAsync({ roomId: "room-1", sourceScheduleId: 10, itemId: 101, targetScheduleId: 20, targetOrderIndex: 0 })
        .catch((error: unknown) => error);
    });
    await hook.flush();
    expect(ids(client.getQueryData<PlanPlace[]>(sourceKey))).toEqual([100]);
    expect(ids(client.getQueryData<PlanPlace[]>(targetKey))).toEqual([101, 200]);

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
      await hook.current.mutateAsync({ roomId: "room-1", sourceScheduleId: 10, itemId: 101, targetScheduleId: 20, targetOrderIndex: 1 });
    });
    expect(ids(client.getQueryData<PlanPlace[]>(sourceKey))).toEqual([100]);
    expect(ids(client.getQueryData<PlanPlace[]>(targetKey))).toEqual([200, 101]);
  } finally {
    unwatch.forEach((stop) => stop());
    await hook.unmount();
    client.clear();
  }
});

it("draws only the latest order when two reorders on the same day overlap, and refetches the day once after the last save", async () => {
  const client = newClient();
  const key = scheduleItemsQueryKey("room-1", 10);
  client.setQueryData(key, [place(100), place(101), place(102)]);
  // 일정 화면처럼 일차 목록을 보고 있는 구독자 — 무효화하면 바로 다시 받는다
  const unwatch = new QueryObserver(
    client,
    schedulePlanPlacesQueryOptions(client, "room-1", 10),
  ).subscribe(() => {});
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
      firstSaving = hook.current.mutateAsync({ roomId: "room-1", scheduleId: 10, itemId: 100, body: { newOrderIndex: 2 } });
    });
    await hook.flush();
    await act(async () => {
      secondSaving = hook.current.mutateAsync({ roomId: "room-1", scheduleId: 10, itemId: 101, body: { newOrderIndex: 2 } });
    });
    await hook.flush();
    expect(ids(client.getQueryData<PlanPlace[]>(key))).toEqual([102, 100, 101]);

    // 앞 저장의 응답(서버에는 앞 저장만 반영)이 와도 그 순서를 그리지 않고, 아직 다시 받지 않는다
    await act(async () => {
      first.resolve(items(101, 102, 100));
      await firstSaving;
    });
    await hook.flush();
    expect(ids(client.getQueryData<PlanPlace[]>(key))).toEqual([102, 100, 101]);
    expect(api.getScheduleItems).not.toHaveBeenCalled();

    // 마지막 저장이 끝나면 한 번만 다시 받는다
    await act(async () => {
      second.resolve(items(102, 100, 101));
      await secondSaving;
    });
    expect(api.getScheduleItems).toHaveBeenCalledTimes(1);
    expect(ids(client.getQueryData<PlanPlace[]>(key))).toEqual([102, 100, 101]);
  } finally {
    unwatch();
    await hook.unmount();
    client.clear();
  }
});
