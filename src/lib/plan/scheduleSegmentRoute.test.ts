import { QueryClient } from "@tanstack/react-query";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/rooms/schedule-items", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/rooms/schedule-items")>();
  return {
    ...actual,
    getScheduleItemRoute: vi.fn(),
  };
});

let resolveScheduleSegmentRoute: typeof import("@/lib/plan/scheduleSegmentRoute").resolveScheduleSegmentRoute;
let scheduleItemRouteQueryKey: typeof import("@/lib/query-keys").scheduleItemRouteQueryKey;
let registerQueryClient: typeof import("@/lib/query-client").registerQueryClient;
let getScheduleItemRouteMock: ReturnType<typeof vi.fn>;

const ROOM_ID = "room-1";
const SCHEDULE_ID = 10;
const ITEM_ID = 1;
const DESTINATION = "place-b";

const ROUTE = {
  distanceMeters: 1200,
  durationSeconds: 300,
  travelMode: "DRIVING",
  encodedPolyline: "_p~iF~ps|U_ulLnnqC",
};

let queryClient: QueryClient;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:8080";
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "test-client";
  process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI = "http://localhost/callback";
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "test-maps-key";

  ({ resolveScheduleSegmentRoute } = await import(
    "@/lib/plan/scheduleSegmentRoute"
  ));
  ({ scheduleItemRouteQueryKey } = await import("@/lib/query-keys"));
  ({ registerQueryClient } = await import("@/lib/query-client"));
  ({ getScheduleItemRoute: getScheduleItemRouteMock } = vi.mocked(
    await import("@/lib/api/rooms/schedule-items"),
  ));
});

beforeEach(() => {
  getScheduleItemRouteMock.mockReset();
  queryClient = new QueryClient();
  registerQueryClient(queryClient);
});

const ROUTE_KEY = (destination = DESTINATION) =>
  scheduleItemRouteQueryKey(ROOM_ID, SCHEDULE_ID, ITEM_ID, destination, "DRIVING");

function resolve(destinationPlaceId = DESTINATION) {
  return resolveScheduleSegmentRoute({
    roomId: ROOM_ID,
    scheduleId: SCHEDULE_ID,
    segmentSourceItemId: ITEM_ID,
    destinationPlaceId,
    travelMode: "DRIVING",
  });
}

describe("resolveScheduleSegmentRoute", () => {
  it("구간 캐시에 값이 있으면 단건 GET을 하지 않는다", async () => {
    queryClient.setQueryData(ROUTE_KEY(), ROUTE);

    await expect(resolve()).resolves.toEqual(ROUTE);
    expect(getScheduleItemRouteMock).not.toHaveBeenCalled();
  });

  it("캐시 miss면 단건 GET 결과를 반환한다", async () => {
    getScheduleItemRouteMock.mockResolvedValue(ROUTE);

    await expect(resolve()).resolves.toEqual(ROUTE);
    expect(getScheduleItemRouteMock).toHaveBeenCalledTimes(1);
  });

  it("경로 없음(204)은 null을 반환한다", async () => {
    getScheduleItemRouteMock.mockResolvedValue(null);

    await expect(resolve()).resolves.toBeNull();
  });

  it("같은 출발 항목이라도 도착 장소가 다르면 그 도착 장소의 경로를 받고, 순서를 되돌리면 받아 둔 경로를 쓴다", async () => {
    queryClient.setQueryData(ROUTE_KEY("place-b"), ROUTE);
    const toC = { ...ROUTE, distanceMeters: 999, encodedPolyline: "zzz" };
    getScheduleItemRouteMock.mockResolvedValue(toC);

    await expect(resolve("place-c")).resolves.toEqual(toC);
    await expect(resolve("place-b")).resolves.toEqual(ROUTE);
    expect(getScheduleItemRouteMock).toHaveBeenCalledTimes(1);
  });

  it("캐시가 무효화된 상태면 낡은 값을 쓰지 않고 다시 조회한다", async () => {
    queryClient.setQueryData(ROUTE_KEY(), ROUTE);
    await queryClient.invalidateQueries({
      queryKey: ROUTE_KEY(),
      refetchType: "none",
    });

    const reordered = { ...ROUTE, distanceMeters: 999, encodedPolyline: "zzz" };
    getScheduleItemRouteMock.mockResolvedValue(reordered);

    await expect(resolve()).resolves.toEqual(reordered);
    expect(getScheduleItemRouteMock).toHaveBeenCalledTimes(1);
  });

  /** 캐시 쓰기는 이 리졸버를 queryFn으로 쓰는 쿼리가 맡는다 */
  it("캐시에 직접 쓰지 않는다", async () => {
    getScheduleItemRouteMock.mockResolvedValue(ROUTE);

    await resolve();

    expect(queryClient.getQueryData(ROUTE_KEY())).toBeUndefined();
  });
});
