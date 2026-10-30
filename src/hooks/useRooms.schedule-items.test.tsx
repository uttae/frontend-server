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

import { useDeleteScheduleItem } from "./useRooms";

const api = vi.hoisted(() => ({
  deleteScheduleItem: vi.fn(),
  getScheduleItems: vi.fn(),
}));
vi.mock("@/lib/client-env", () => ({
  clientEnv: { NEXT_PUBLIC_API_BASE_URL: "https://api.example.test" },
}));
vi.mock("@/lib/api/rooms/schedule-items", async (original) => ({
  ...(await original<object>()),
  deleteScheduleItem: api.deleteScheduleItem,
  getScheduleItems: api.getScheduleItems,
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
