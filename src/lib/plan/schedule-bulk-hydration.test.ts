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
let persistedScheduleItemRouteQueryOptions: typeof import("@/lib/plan/scheduleItemRoutePersistedQuery").persistedScheduleItemRouteQueryOptions;
let loadScheduleItemRouteForMap: typeof import("@/lib/plan/scheduleItemRoutePersistedQuery").loadScheduleItemRouteForMap;
let flattenPlanItinerarySegmentsFromPlaces: typeof import("@/lib/plan/planItineraryMapSegments").flattenPlanItinerarySegmentsFromPlaces;
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
    travelMode: "DRIVING",
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
  ({ persistedScheduleItemRouteQueryOptions, loadScheduleItemRouteForMap } = await import(
    "@/lib/plan/scheduleItemRoutePersistedQuery"
  ));
  ({ flattenPlanItinerarySegmentsFromPlaces } = await import(
    "@/lib/plan/planItineraryMapSegments"
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
    toItemId: 2,
    travelMode: "DRIVING",
    distanceMeters: 1200,
    durationSeconds: 300,
    encodedPolyline: "_p~iF~ps|U_ulLnnqC",
  };

  it("응답이 알려 준 출발·도착 항목 구간으로 경로를 시딩한다", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      scheduleItemsQueryKey(ROOM_ID, SCHEDULE_ID),
      snapshot,
    );
    getScheduleItemRoutesBatchMock.mockResolvedValue([routeResult]);

    await hydrateScheduleRoutesBatch(queryClient, ROOM_ID, SCHEDULE_ID, snapshot);

    expect(
      queryClient.getQueryData(
        scheduleItemRouteQueryKey(ROOM_ID, SCHEDULE_ID, 1, 2, "DRIVING"),
      ),
    ).toMatchObject({
      distanceMeters: 1200,
      durationSeconds: 300,
      encodedPolyline: "_p~iF~ps|U_ulLnnqC",
    });
  });

  it("미지원 수단 구간은 제외하고 지원하는 구간만 조회한다", async () => {
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
        scheduleItemRouteQueryKey(ROOM_ID, SCHEDULE_ID, 1, 2, "DRIVING"),
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
        toItemId: 3,
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
      3,
      "WALKING",
    );
    expect(queryClient.getQueryData(failedKey)).toBeUndefined();
    await expect(
      resolveScheduleSegmentRoute({
        roomId: ROOM_ID,
        scheduleId: SCHEDULE_ID,
        segmentSourceItemId: 2,
        destinationItemId: 3,
        travelMode: "WALKING",
      }),
    ).rejects.toThrow("temporary single route failure");
    expect(queryClient.getQueryData(failedKey)).toBeUndefined();
    await expect(
      resolveScheduleSegmentRoute({
        roomId: ROOM_ID,
        scheduleId: SCHEDULE_ID,
        segmentSourceItemId: 2,
        destinationItemId: 3,
        travelMode: "WALKING",
      }),
    ).resolves.toEqual(fallbackRoute);
    expect(getScheduleItemRouteMock).toHaveBeenCalledTimes(2);
  });

  it("경로 없음 답(NO_ROUTE)은 그 구간을 null로 시딩해 단건으로 다시 묻지 않는다", async () => {
    const queryClient = new QueryClient();
    registerQueryClient(queryClient);
    const places = [place(1, "places/a"), place(2, "places/b"), place(3, "places/c")];
    queryClient.setQueryData(scheduleItemsQueryKey(ROOM_ID, SCHEDULE_ID), places);
    getScheduleItemRoutesBatchMock.mockResolvedValue([
      routeResult,
      { status: "FAILED", itemId: 2, toItemId: 3, travelMode: "WALKING", errorCode: "NO_ROUTE" },
    ]);

    await hydrateScheduleRoutesBatch(queryClient, ROOM_ID, SCHEDULE_ID, places);

    expect(
      queryClient.getQueryData(scheduleItemRouteQueryKey(ROOM_ID, SCHEDULE_ID, 2, 3, "WALKING")),
    ).toBeNull();
    await expect(
      resolveScheduleSegmentRoute({
        roomId: ROOM_ID,
        scheduleId: SCHEDULE_ID,
        segmentSourceItemId: 2,
        destinationItemId: 3,
        travelMode: "WALKING",
      }),
    ).resolves.toBeNull();
    expect(getScheduleItemRouteMock).not.toHaveBeenCalled();
  });

  it.each(["LAST_ITEM", "SCHEDULE_ITEM_NOT_FOUND"])(
    "도착 항목이 없는 답(%s)은 시딩하지 않고 그 칸이 도착 항목을 지정한 단건으로 받는다",
    async (errorCode) => {
      const queryClient = new QueryClient();
      registerQueryClient(queryClient);
      const places = [place(1, "places/a"), place(2, "places/b"), place(3, "places/c")];
      queryClient.setQueryData(scheduleItemsQueryKey(ROOM_ID, SCHEDULE_ID), places);
      getScheduleItemRoutesBatchMock.mockResolvedValue([
        routeResult,
        { status: "FAILED", itemId: 2, travelMode: "WALKING", errorCode },
      ]);
      const toThree = { travelMode: "WALKING", distanceMeters: 800, durationSeconds: 600 };
      getScheduleItemRouteMock.mockResolvedValue(toThree);

      await hydrateScheduleRoutesBatch(queryClient, ROOM_ID, SCHEDULE_ID, places);

      expect(
        queryClient.getQueryState(scheduleItemRouteQueryKey(ROOM_ID, SCHEDULE_ID, 2, 3, "WALKING")),
      ).toBeUndefined();
      await expect(
        resolveScheduleSegmentRoute({
          roomId: ROOM_ID,
          scheduleId: SCHEDULE_ID,
          segmentSourceItemId: 2,
          destinationItemId: 3,
          travelMode: "WALKING",
        }),
      ).resolves.toEqual(toThree);
      expect(getScheduleItemRouteMock).toHaveBeenCalledExactlyOnceWith(ROOM_ID, SCHEDULE_ID, 2, 3, "WALKING");
    },
  );

  it("응답 대기 중 순서가 바뀌어도 응답이 알려 준 구간에 저장하고 새 순서의 구간에는 넣지 않는다", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      scheduleItemsQueryKey(ROOM_ID, SCHEDULE_ID),
      snapshot,
    );
    getScheduleItemRoutesBatchMock.mockImplementation(async () => {
      // batch 응답이 도착하기 전에 1번 다음 장소가 2 → 3으로 바뀐 상황 — 서버는 요청을 받은 순간의 1→2를 계산했다
      queryClient.setQueryData(scheduleItemsQueryKey(ROOM_ID, SCHEDULE_ID), [
        place(1, "places/a"),
        place(3, "places/c"),
      ]);
      return [routeResult];
    });

    await hydrateScheduleRoutesBatch(queryClient, ROOM_ID, SCHEDULE_ID, snapshot);

    expect(
      queryClient.getQueryData(
        scheduleItemRouteQueryKey(ROOM_ID, SCHEDULE_ID, 1, 2, "DRIVING"),
      ),
    ).toMatchObject({ distanceMeters: 1200 });
    expect(
      queryClient.getQueryState(
        scheduleItemRouteQueryKey(ROOM_ID, SCHEDULE_ID, 1, 3, "DRIVING"),
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
    queryClient.setQueryData(scheduleItemRouteQueryKey(ROOM_ID, SCHEDULE_ID, 1, 2, "DRIVING"), route);
    queryClient.setQueryData(scheduleItemRouteQueryKey(ROOM_ID, SCHEDULE_ID, 2, 3, "DRIVING"), route);
    return queryClient;
  }

  it("모든 구간 경로가 캐시에 있으면 일괄 요청을 보내지 않는다", async () => {
    await fetchAndSeedScheduleRoutesBatch(seededClient(), ROOM_ID, SCHEDULE_ID, places);

    expect(getScheduleItemRoutesBatchMock).not.toHaveBeenCalled();
  });

  it("캐시에 없는 구간이 있으면 일괄로 다시 받는다", async () => {
    const queryClient = seededClient();
    queryClient.removeQueries({ queryKey: scheduleItemRouteQueryKey(ROOM_ID, SCHEDULE_ID, 2, 3, "DRIVING") });
    getScheduleItemRoutesBatchMock.mockResolvedValue([]);

    await fetchAndSeedScheduleRoutesBatch(queryClient, ROOM_ID, SCHEDULE_ID, places);

    expect(getScheduleItemRoutesBatchMock).toHaveBeenCalledOnce();
  });

  it("순서를 바꿨다가 되돌리면 받아 둔 경로가 있어 일괄 요청을 보내지 않는다", async () => {
    const queryClient = seededClient();
    const reordered = [place(1, "places/a"), place(3, "places/c"), place(2, "places/b")];
    queryClient.setQueryData(scheduleItemsQueryKey(ROOM_ID, SCHEDULE_ID), reordered);
    getScheduleItemRoutesBatchMock.mockResolvedValue([]);

    await fetchAndSeedScheduleRoutesBatch(queryClient, ROOM_ID, SCHEDULE_ID, reordered);
    queryClient.setQueryData(scheduleItemsQueryKey(ROOM_ID, SCHEDULE_ID), places);
    await fetchAndSeedScheduleRoutesBatch(queryClient, ROOM_ID, SCHEDULE_ID, places);

    expect(getScheduleItemRoutesBatchMock).toHaveBeenCalledOnce();
  });

  it("일정 변경으로 무효화된 구간이 있으면 일괄로 다시 받는다", async () => {
    const queryClient = seededClient();
    await queryClient.invalidateQueries({
      queryKey: scheduleItemRouteQueryKey(ROOM_ID, SCHEDULE_ID, 1, 2, "DRIVING"),
      refetchType: "none",
    });
    getScheduleItemRoutesBatchMock.mockResolvedValue([]);

    await fetchAndSeedScheduleRoutesBatch(queryClient, ROOM_ID, SCHEDULE_ID, places);

    expect(getScheduleItemRoutesBatchMock).toHaveBeenCalledOnce();
  });
});

describe("진입 batch·일정 목록·지도가 같은 구간 경로 캐시를 쓴다", () => {
  const places = [place(1, "places/a"), place(2, "places/b"), place(3, "places/c")];
  const batchRoute = (itemId: number, distanceMeters: number) => ({
    status: "OK" as const,
    itemId,
    toItemId: itemId + 1,
    travelMode: "DRIVING",
    distanceMeters,
    durationSeconds: 60,
    encodedPolyline: "_p~iF~ps|U_ulLnnqC",
  });

  it("진입 batch가 받아 둔 경로를 목록 칸과 지도가 다시 요청하지 않고 쓴다", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(scheduleItemsQueryKey(ROOM_ID, SCHEDULE_ID), places);
    getScheduleItemRoutesBatchMock.mockResolvedValue([batchRoute(1, 100), batchRoute(2, 200)]);

    await fetchAndSeedScheduleRoutesBatch(queryClient, ROOM_ID, SCHEDULE_ID, places);

    // 목록 칸 — PlanItinerary가 넘기는 것처럼 다음 장소의 itemId로 조회한다
    const listDistances = await Promise.all(
      places.slice(0, -1).map((origin, index) =>
        queryClient
          .fetchQuery(
            persistedScheduleItemRouteQueryOptions(
              ROOM_ID,
              SCHEDULE_ID,
              origin.itemId ?? null,
              places[index + 1]?.itemId ?? null,
              "DRIVING",
              "",
              { segmentReady: true },
            ),
          )
          .then((route) => route?.distanceMeters),
      ),
    );
    // 지도 — 지도가 쓰는 구간 계산 그대로 조회한다
    const mapDistances = await Promise.all(
      flattenPlanItinerarySegmentsFromPlaces([SCHEDULE_ID], [places]).map((segment) =>
        loadScheduleItemRouteForMap(
          queryClient,
          persistedScheduleItemRouteQueryOptions(
            ROOM_ID,
            segment.scheduleId,
            segment.segmentSourceItemId,
            segment.destinationItemId,
            segment.travelModeCanon,
            "",
            { segmentReady: true },
          ),
        ).then((route) => route?.distanceMeters),
      ),
    );

    expect(listDistances).toEqual([100, 200]);
    expect(mapDistances).toEqual([100, 200]);
    expect(getScheduleItemRoutesBatchMock).toHaveBeenCalledOnce();
    expect(getScheduleItemRouteMock).not.toHaveBeenCalled();
  });
});
