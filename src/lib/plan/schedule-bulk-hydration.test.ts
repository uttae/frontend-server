import { QueryClient } from "@tanstack/react-query";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { PlanPlace } from "@/lib/plan/types";

vi.mock("@/lib/api/rooms/schedule-items", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/rooms/schedule-items")>();
  return {
    ...actual,
    getScheduleItemRoute: vi.fn(),
    getScheduleItemRoutesBatch: vi.fn(),
  };
});

let hydrateScheduleRoutesBatch: typeof import("@/lib/plan/schedule-bulk-hydration").hydrateScheduleRoutesBatch;
let fetchAndSeedScheduleRoutesBatch: typeof import("@/lib/plan/schedule-bulk-hydration").fetchAndSeedScheduleRoutesBatch;
let resolveScheduleSegmentRoute: typeof import("@/lib/plan/scheduleSegmentRoute").resolveScheduleSegmentRoute;
let scheduleItemsQueryKey: typeof import("@/lib/query-keys").scheduleItemsQueryKey;
let scheduleItemRouteQueryKey: typeof import("@/lib/query-keys").scheduleItemRouteQueryKey;
let registerQueryClient: typeof import("@/lib/query-client").registerQueryClient;
let getScheduleItemRouteMock: ReturnType<typeof vi.fn>;
let getScheduleItemRoutesBatchMock: ReturnType<typeof vi.fn>;

const ROOM_ID = "room-1";
const SCHEDULE_ID = 10;

function place(itemId: number, googlePlaceId: string): PlanPlace {
  return {
    id: `item-${itemId}`,
    itemId,
    googlePlaceId,
    title: googlePlaceId,
  };
}

beforeAll(async () => {
  process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:8080";
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "test-client";
  process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI = "http://localhost/callback";
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "test-maps-key";

  ({ hydrateScheduleRoutesBatch, fetchAndSeedScheduleRoutesBatch } = await import(
    "@/lib/plan/schedule-bulk-hydration"
  ));
  ({ resolveScheduleSegmentRoute } = await import(
    "@/lib/plan/scheduleSegmentRoute"
  ));
  ({ scheduleItemsQueryKey, scheduleItemRouteQueryKey } = await import(
    "@/lib/query-keys"
  ));
  ({ registerQueryClient } = await import("@/lib/query-client"));
  ({
    getScheduleItemRoute: getScheduleItemRouteMock,
    getScheduleItemRoutesBatch: getScheduleItemRoutesBatchMock,
  } = vi.mocked(await import("@/lib/api/rooms/schedule-items")));
});

beforeEach(() => {
  getScheduleItemRouteMock.mockReset();
  getScheduleItemRoutesBatchMock.mockReset();
});

describe("hydrateScheduleRoutesBatch", () => {
  const snapshot = [place(1, "places/a"), place(2, "places/b")];
  const routeResult = {
    status: "OK" as const,
    itemId: 1,
    travelMode: "DRIVING",
    distanceMeters: 1200,
    durationSeconds: 300,
    encodedPolyline: "_p~iF~ps|U_ulLnnqC",
  };

  it("응답 시점에 일정 지문이 그대로면 경로를 시딩한다", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      scheduleItemsQueryKey(ROOM_ID, SCHEDULE_ID),
      snapshot,
    );
    getScheduleItemRoutesBatchMock.mockResolvedValue([routeResult]);

    await hydrateScheduleRoutesBatch(queryClient, ROOM_ID, SCHEDULE_ID, snapshot);

    expect(
      queryClient.getQueryData(
        scheduleItemRouteQueryKey(ROOM_ID, SCHEDULE_ID, 1, "DRIVING"),
      ),
    ).toMatchObject({
      distanceMeters: 1200,
      durationSeconds: 300,
      encodedPolyline: "_p~iF~ps|U_ulLnnqC",
    });
  });

  it("자전거로 저장된 구간만 화면에 보이는 수단(자동차)으로 계산해 달라고 지정한다", async () => {
    const queryClient = new QueryClient();
    const places = [
      { ...place(1, "places/a"), travelMode: "BICYCLING" },
      { ...place(2, "places/b"), travelMode: "WALKING" },
      place(3, "places/c"),
    ];
    queryClient.setQueryData(scheduleItemsQueryKey(ROOM_ID, SCHEDULE_ID), places);
    getScheduleItemRoutesBatchMock.mockResolvedValue([]);

    await hydrateScheduleRoutesBatch(queryClient, ROOM_ID, SCHEDULE_ID, places);

    expect(getScheduleItemRoutesBatchMock).toHaveBeenCalledWith(ROOM_ID, SCHEDULE_ID, [
      { itemId: 1, travelMode: "DRIVING" },
      { itemId: 2 },
    ]);
  });

  it("폴리라인이 없는 구간은 encodedPolyline 없이 시딩한다", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      scheduleItemsQueryKey(ROOM_ID, SCHEDULE_ID),
      snapshot,
    );
    const withoutPolyline = { ...routeResult };
    delete (withoutPolyline as { encodedPolyline?: string }).encodedPolyline;
    getScheduleItemRoutesBatchMock.mockResolvedValue([withoutPolyline]);

    await hydrateScheduleRoutesBatch(queryClient, ROOM_ID, SCHEDULE_ID, snapshot);

    expect(
      queryClient.getQueryData(
        scheduleItemRouteQueryKey(ROOM_ID, SCHEDULE_ID, 1, "DRIVING"),
      ),
    ).not.toHaveProperty("encodedPolyline");
  });

  it("mixed batch의 비 OK 구간은 no-route로 시딩하지 않고 단건 GET으로 fallback한다", async () => {
    const queryClient = new QueryClient();
    registerQueryClient(queryClient);
    const mixedSnapshot = [
      place(1, "places/a"),
      place(2, "places/b"),
      place(3, "places/c"),
    ];
    queryClient.setQueryData(
      scheduleItemsQueryKey(ROOM_ID, SCHEDULE_ID),
      mixedSnapshot,
    );
    getScheduleItemRoutesBatchMock.mockResolvedValue([
      routeResult,
      {
        status: "ERROR",
        itemId: 2,
        travelMode: "WALKING",
        errorCode: "UPSTREAM_TIMEOUT",
      },
    ]);
    const fallbackRoute = {
      travelMode: "WALKING",
      distanceMeters: 800,
      durationSeconds: 600,
    };
    getScheduleItemRouteMock
      .mockRejectedValueOnce(new Error("temporary single route failure"))
      .mockResolvedValueOnce(fallbackRoute);

    await hydrateScheduleRoutesBatch(
      queryClient,
      ROOM_ID,
      SCHEDULE_ID,
      mixedSnapshot,
    );

    const failedKey = scheduleItemRouteQueryKey(
      ROOM_ID,
      SCHEDULE_ID,
      2,
      "WALKING",
    );
    expect(queryClient.getQueryData(failedKey)).toBeUndefined();
    await expect(
      resolveScheduleSegmentRoute({
        roomId: ROOM_ID,
        scheduleId: SCHEDULE_ID,
        segmentSourceItemId: 2,
        travelMode: "WALKING",
      }),
    ).rejects.toThrow("temporary single route failure");
    expect(queryClient.getQueryData(failedKey)).toBeUndefined();
    await expect(
      resolveScheduleSegmentRoute({
        roomId: ROOM_ID,
        scheduleId: SCHEDULE_ID,
        segmentSourceItemId: 2,
        travelMode: "WALKING",
      }),
    ).resolves.toEqual(fallbackRoute);
    expect(getScheduleItemRouteMock).toHaveBeenCalledTimes(2);
  });

  it("응답 대기 중 일정이 바뀌면(지문 불일치) 늦게 도착한 결과를 버린다", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      scheduleItemsQueryKey(ROOM_ID, SCHEDULE_ID),
      snapshot,
    );
    getScheduleItemRoutesBatchMock.mockImplementation(async () => {
      // batch 응답이 도착하기 전에 목적지가 B → C 로 교체된 상황
      queryClient.setQueryData(scheduleItemsQueryKey(ROOM_ID, SCHEDULE_ID), [
        place(1, "places/a"),
        place(3, "places/c"),
      ]);
      return [routeResult];
    });

    await hydrateScheduleRoutesBatch(queryClient, ROOM_ID, SCHEDULE_ID, snapshot);

    expect(
      queryClient.getQueryData(
        scheduleItemRouteQueryKey(ROOM_ID, SCHEDULE_ID, 1, "DRIVING"),
      ),
    ).toBeUndefined();
  });
});

describe("fetchAndSeedScheduleRoutesBatch", () => {
  const places = [place(1, "places/a"), place(2, "places/b"), place(3, "places/c")];
  const route = { travelMode: "DRIVING", distanceMeters: 100, durationSeconds: 60 };

  function seededClient() {
    const queryClient = new QueryClient();
    queryClient.setQueryData(scheduleItemsQueryKey(ROOM_ID, SCHEDULE_ID), places);
    queryClient.setQueryData(scheduleItemRouteQueryKey(ROOM_ID, SCHEDULE_ID, 1, "DRIVING"), route);
    queryClient.setQueryData(scheduleItemRouteQueryKey(ROOM_ID, SCHEDULE_ID, 2, "DRIVING"), route);
    return queryClient;
  }

  it("모든 구간 경로가 캐시에 있으면 일괄 요청을 보내지 않는다", async () => {
    await fetchAndSeedScheduleRoutesBatch(seededClient(), ROOM_ID, SCHEDULE_ID, places);

    expect(getScheduleItemRoutesBatchMock).not.toHaveBeenCalled();
  });

  it("캐시에 없는 구간이 있으면 일괄로 다시 받는다", async () => {
    const queryClient = seededClient();
    queryClient.removeQueries({ queryKey: scheduleItemRouteQueryKey(ROOM_ID, SCHEDULE_ID, 2, "DRIVING") });
    getScheduleItemRoutesBatchMock.mockResolvedValue([]);

    await fetchAndSeedScheduleRoutesBatch(queryClient, ROOM_ID, SCHEDULE_ID, places);

    expect(getScheduleItemRoutesBatchMock).toHaveBeenCalledOnce();
  });

  it("일정 변경으로 무효화된 구간이 있으면 일괄로 다시 받는다", async () => {
    const queryClient = seededClient();
    await queryClient.invalidateQueries({
      queryKey: scheduleItemRouteQueryKey(ROOM_ID, SCHEDULE_ID, 1, "DRIVING"),
      refetchType: "none",
    });
    getScheduleItemRoutesBatchMock.mockResolvedValue([]);

    await fetchAndSeedScheduleRoutesBatch(queryClient, ROOM_ID, SCHEDULE_ID, places);

    expect(getScheduleItemRoutesBatchMock).toHaveBeenCalledOnce();
  });
});
