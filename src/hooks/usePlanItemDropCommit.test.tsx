// @vitest-environment jsdom
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";

import type { RoomScheduleItem } from "@/lib/api/rooms";
import type { PlanItemDrop } from "@/lib/plan/planItemDrop";
import { bucketItemCount } from "@/lib/analytics/context";
import { trackAnalyticsEvent } from "@/lib/analytics/track";
import { hookHarness } from "@/test/hook-harness";

import { usePlanItemDropCommit } from "./usePlanItemDropCommit";

const api = vi.hoisted(() => ({ reorder: vi.fn(), move: vi.fn() }));
vi.mock("@/lib/client-env", () => ({ clientEnv: { NEXT_PUBLIC_API_BASE_URL: "https://api.example.test" } }));
vi.mock("@/lib/api/rooms", async (original) => ({
  ...(await original<object>()),
  reorderScheduleItem: api.reorder,
  moveScheduleItemToSchedule: api.move,
}));
vi.mock("@/lib/analytics/track", () => ({
  AnalyticsEvents: { reorderItinerary: "reorder_itinerary" },
  trackAnalyticsEvent: vi.fn(),
}));
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError } }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

/** 기본: 10일차(2곳)의 0번째를 1번째로 */
const drop = (overrides: Partial<PlanItemDrop> = {}): PlanItemDrop => ({
  itemId: 1,
  from: { scheduleId: 10, index: 0 },
  to: { scheduleId: 10, index: 1, length: 2 },
  ...overrides,
});
const items = (count: number): RoomScheduleItem[] =>
  Array.from({ length: count }, (_, orderIndex) => ({
    itemId: orderIndex + 1, scheduleId: 10, googlePlaceId: `g${orderIndex + 1}`, orderIndex,
    startTime: null, endTime: null, travelMode: "DRIVING", createdAt: "2026-11-08",
  }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderCommit(client: QueryClient) {
  return hookHarness(
    (roomId: string) => usePlanItemDropCommit(roomId),
    (child) => <QueryClientProvider client={client}>{child}</QueryClientProvider>,
  );
}

let client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});

it("sends one reorder_itinerary for a saved same-day drop, attributed to the room the drop was made in", async () => {
  const reorder = deferred<RoomScheduleItem[]>();
  api.reorder.mockReturnValueOnce(reorder.promise);
  const onSettled = vi.fn();
  const hook = renderCommit(client);
  try {
    await hook.render("room-a");
    let started = false;
    await act(async () => {
      started = hook.current.commitPlanItemDrop(drop(), onSettled);
    });
    expect(started).toBe(true);
    expect(api.reorder).toHaveBeenCalledWith("room-a", 10, 1, { newOrderIndex: 1 });
    // 낙관적 표시는 쓰기 이벤트가 아니다 — 저장이 끝나기 전에는 보내지 않는다
    expect(trackAnalyticsEvent).not.toHaveBeenCalled();
    await hook.render("room-b");
    await act(async () => {
      reorder.resolve(items(2));
      await reorder.promise;
    });
    await hook.flush();
    expect(trackAnalyticsEvent).toHaveBeenCalledExactlyOnceWith("reorder_itinerary", {
      room_id: "room-a",
      item_count_bucket: bucketItemCount(2),
      method: "drag_drop",
    });
    expect(onSettled).toHaveBeenCalledOnce();
  } finally {
    await hook.unmount();
    client.clear();
  }
});

it("shows the failure toast and still settles when a same-day reorder fails", async () => {
  api.reorder.mockRejectedValueOnce(new Error("서버 오류"));
  const onSettled = vi.fn();
  const hook = renderCommit(client);
  try {
    await hook.render("room-a");
    await act(async () => {
      hook.current.commitPlanItemDrop(drop(), onSettled);
    });
    await hook.flush();
    expect(toastError).toHaveBeenCalledWith("순서를 바꾸지 못했어요.");
    expect(trackAnalyticsEvent).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledOnce();
  } finally {
    await hook.unmount();
    client.clear();
  }
});

it("saves a drop on another day as a cross-day move without a reorder_itinerary event", async () => {
  api.move.mockResolvedValueOnce({});
  const hook = renderCommit(client);
  try {
    await hook.render("room-a");
    await act(async () => {
      hook.current.commitPlanItemDrop(
        drop({ to: { scheduleId: 20, index: 9, length: 1 } }),
        vi.fn(),
      );
    });
    await hook.flush();
    expect(api.move).toHaveBeenCalledWith("room-a", 10, 1, { targetScheduleId: 20, targetOrderIndex: 1 });
    expect(api.reorder).not.toHaveBeenCalled();
    expect(trackAnalyticsEvent).not.toHaveBeenCalled();
  } finally {
    await hook.unmount();
    client.clear();
  }
});

it("shows the server message when a cross-day move fails", async () => {
  api.move.mockRejectedValueOnce(new Error("대상 일차를 찾을 수 없어요."));
  const hook = renderCommit(client);
  try {
    await hook.render("room-a");
    await act(async () => {
      hook.current.commitPlanItemDrop(drop({ to: { scheduleId: 20, index: 1, length: 2 } }), vi.fn());
    });
    await hook.flush();
    expect(toastError).toHaveBeenCalledWith("대상 일차를 찾을 수 없어요.");
  } finally {
    await hook.unmount();
    client.clear();
  }
});

it("shows the plain message instead of the browser's network error when a cross-day move cannot reach the server", async () => {
  api.move.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  const hook = renderCommit(client);
  try {
    await hook.render("room-a");
    await act(async () => {
      hook.current.commitPlanItemDrop(drop({ to: { scheduleId: 20, index: 1, length: 2 } }), vi.fn());
    });
    await hook.flush();
    expect(toastError).toHaveBeenCalledWith("다른 일차로 옮기지 못했어요.");
  } finally {
    await hook.unmount();
    client.clear();
  }
});

it("does not save a drop made in place", async () => {
  const hook = renderCommit(client);
  try {
    await hook.render("room-a");
    let started = true;
    await act(async () => {
      started = hook.current.commitPlanItemDrop(drop({ to: { scheduleId: 10, index: 0, length: 2 } }), vi.fn());
    });
    expect(started).toBe(false);
    expect(api.reorder).not.toHaveBeenCalled();
  } finally {
    await hook.unmount();
    client.clear();
  }
});

it("saves the next drop while the previous one is still saving, and still reports the earlier failure", async () => {
  const first = deferred<RoomScheduleItem[]>();
  api.reorder.mockReturnValueOnce(first.promise).mockResolvedValueOnce(items(2));
  const firstSettled = vi.fn();
  const hook = renderCommit(client);
  try {
    await hook.render("room-a");
    let second = false;
    await act(async () => {
      hook.current.commitPlanItemDrop(drop(), firstSettled);
    });
    await hook.flush();
    // 잠금이 없어 앞 저장 중에 또 놓을 수 있다
    await act(async () => {
      second = hook.current.commitPlanItemDrop(
        drop({ itemId: 2, from: { scheduleId: 10, index: 1 }, to: { scheduleId: 10, index: 0, length: 2 } }),
        vi.fn(),
      );
    });
    expect(second).toBe(true);
    expect(api.reorder).toHaveBeenNthCalledWith(2, "room-a", 10, 2, { newOrderIndex: 0 });
    // 앞 저장이 늦게 실패해도 그 실패 토스트와 onSettled는 받는다(호출마다 promise가 따로)
    await act(async () => {
      first.reject(new Error("서버 오류"));
      await first.promise.catch(() => {});
    });
    await hook.flush();
    expect(toastError).toHaveBeenCalledWith("순서를 바꾸지 못했어요.");
    expect(firstSettled).toHaveBeenCalledOnce();
  } finally {
    await hook.unmount();
    client.clear();
  }
});
