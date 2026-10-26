import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { RoomScheduleWithItems } from "@/lib/api/rooms/schedules";
import type { PlanPlace } from "@/lib/plan/types";

const requestPlacePreviewsBatch = vi.hoisted(() => vi.fn());
const requestPlacePreview = vi.hoisted(() => vi.fn());

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:8080";
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "test-client";
  process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI = "http://localhost/callback";
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "test-maps-key";
});

vi.mock("@/lib/api/places", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/places")>();
  return { ...actual, requestPlacePreviewsBatch, requestPlacePreview };
});

let hydrateScheduleItemsFromSchedulesWithItems: typeof import("@/lib/plan/schedule-bulk-hydration").hydrateScheduleItemsFromSchedulesWithItems;
let ensureSchedulePlanPlacesEnriched: typeof import("@/lib/plan/scheduleItemPlaces").ensureSchedulePlanPlacesEnriched;
let PLAN_PLACE_PREVIEW_ERROR_TITLE: string;
let createQueryClient: typeof import("@/lib/query-client").createQueryClient;
let scheduleItemsQueryKey: typeof import("@/lib/query-keys").scheduleItemsQueryKey;
let roomSchedulesQueryKey: typeof import("@/lib/query-keys").roomSchedulesQueryKey;
let placePreviewQueryKey: typeof import("@/lib/places/place-queries").placePreviewQueryKey;
let HttpError: typeof import("@/lib/api/errors").HttpError;

beforeAll(async () => {
  ({ hydrateScheduleItemsFromSchedulesWithItems, PLAN_PLACE_PREVIEW_ERROR_TITLE } = await import(
    "@/lib/plan/schedule-bulk-hydration"
  ));
  ({ ensureSchedulePlanPlacesEnriched } = await import("@/lib/plan/scheduleItemPlaces"));
  ({ createQueryClient } = await import("@/lib/query-client"));
  ({ scheduleItemsQueryKey, roomSchedulesQueryKey } = await import("@/lib/query-keys"));
  ({ placePreviewQueryKey } = await import("@/lib/places/place-queries"));
  ({ HttpError } = await import("@/lib/api/errors"));
});

beforeEach(() => {
  requestPlacePreviewsBatch.mockReset();
  requestPlacePreview.mockReset();
});

const ROOM_ID = "room-1";

function schedule(scheduleId: number, googlePlaceIds: string[]): RoomScheduleWithItems {
  return {
    scheduleId,
    roomId: ROOM_ID,
    dayNumber: scheduleId,
    date: "2026-11-01",
    createdAt: "2026-10-01T00:00:00",
    items: googlePlaceIds.map((googlePlaceId, orderIndex) => ({
      itemId: scheduleId * 100 + orderIndex,
      scheduleId,
      googlePlaceId,
      startTime: null,
      endTime: null,
      orderIndex,
      travelMode: "DRIVING",
      createdAt: "2026-10-01T00:00:00",
    })),
  };
}

const ok = (googlePlaceId: string) => ({
  status: "OK",
  googlePlaceId,
  name: `이름 ${googlePlaceId}`,
  formattedAddress: "서울",
  location: { latitude: 37.5, longitude: 127.0 },
  primaryType: "cafe",
  primaryTypeDisplayName: "카페",
});
const failed = (googlePlaceId: string) => ({
  status: "FAILED",
  googlePlaceId,
  errorCode: "EXTERNAL_API_ERROR",
});

function titles(queryClient: ReturnType<typeof createQueryClient>, scheduleId: number) {
  return (
    queryClient.getQueryData<PlanPlace[]>(scheduleItemsQueryKey(ROOM_ID, scheduleId)) ?? []
  ).map((place) => place.title);
}

describe("hydrateScheduleItemsFromSchedulesWithItems", () => {
  it("모든 일차 장소를 batch 한 번으로 받고 실패한 곳만 batch로 한 번 더 받는다 — 단건으로는 받지 않는다", async () => {
    const queryClient = createQueryClient();
    requestPlacePreviewsBatch
      .mockResolvedValueOnce([ok("a"), failed("b"), ok("c"), failed("d")])
      .mockResolvedValueOnce([ok("b"), failed("d")]);

    await hydrateScheduleItemsFromSchedulesWithItems(queryClient, ROOM_ID, [
      schedule(1, ["a", "b"]),
      schedule(2, ["c", "d"]),
    ]);

    expect(requestPlacePreviewsBatch.mock.calls).toEqual([[["a", "b", "c", "d"]], [["b", "d"]]]);
    expect(requestPlacePreview).not.toHaveBeenCalled();
    expect(titles(queryClient, 1)).toEqual(["이름 a", "이름 b"]);
    expect(titles(queryClient, 2)).toEqual(["이름 c", PLAN_PLACE_PREVIEW_ERROR_TITLE]);
  });

  it("미리보기 batch 요청이 실패해도 일정은 자리표시자로 채우고 다시 보내지 않는다", async () => {
    const queryClient = createQueryClient();
    requestPlacePreviewsBatch.mockRejectedValueOnce(new HttpError(429, "요청이 너무 많습니다"));

    await hydrateScheduleItemsFromSchedulesWithItems(queryClient, ROOM_ID, [schedule(1, ["a", "b"])]);

    expect(requestPlacePreviewsBatch).toHaveBeenCalledTimes(1);
    expect(requestPlacePreview).not.toHaveBeenCalled();
    expect(titles(queryClient, 1)).toEqual([
      PLAN_PLACE_PREVIEW_ERROR_TITLE,
      PLAN_PLACE_PREVIEW_ERROR_TITLE,
    ]);
  });
});

describe("ensureSchedulePlanPlacesEnriched", () => {
  const placeholder = (googlePlaceId: string, itemId: number): PlanPlace => ({
    id: `item-${itemId}`,
    itemId,
    googlePlaceId,
    title: PLAN_PLACE_PREVIEW_ERROR_TITLE,
    subtitle: googlePlaceId,
  });

  it("일정 불러오기가 진행 중이면 끝날 때까지 기다려 그 결과를 쓰고, 미리보기를 다시 받지 않는다", async () => {
    const queryClient = createQueryClient();
    let finishHydration: (schedules: RoomScheduleWithItems[]) => void = () => {};
    const hydration = queryClient.fetchQuery({
      queryKey: roomSchedulesQueryKey(ROOM_ID),
      queryFn: () =>
        new Promise<RoomScheduleWithItems[]>((resolve) => {
          finishHydration = resolve;
        }),
    });

    const enriching = ensureSchedulePlanPlacesEnriched(queryClient, ROOM_ID, 1);
    const hydratedPlaces = [placeholder("a", 100)];
    queryClient.setQueryData(scheduleItemsQueryKey(ROOM_ID, 1), hydratedPlaces);
    finishHydration([schedule(1, ["a"])]);
    await hydration;

    await expect(enriching).resolves.toBe(hydratedPlaces);
    expect(requestPlacePreviewsBatch).not.toHaveBeenCalled();
    expect(requestPlacePreview).not.toHaveBeenCalled();
  });

  it("기다리던 일정 불러오기가 취소되고 다시 시작되면 새 불러오기를 기다려 그 결과를 쓴다", async () => {
    const queryClient = createQueryClient();
    // 이미 받은 일정을 다시 받는 중에 또 다시 받으면 TanStack이 진행 중인 불러오기를 취소한다
    queryClient.setQueryData(roomSchedulesQueryKey(ROOM_ID), [schedule(1, ["a"])]);
    const finishHydrations: Array<(schedules: RoomScheduleWithItems[]) => void> = [];
    const queryFn = () =>
      new Promise<RoomScheduleWithItems[]>((resolve) => {
        finishHydrations.push(resolve);
      });
    void queryClient.fetchQuery({ queryKey: roomSchedulesQueryKey(ROOM_ID), queryFn, staleTime: 0 });

    const enriching = ensureSchedulePlanPlacesEnriched(queryClient, ROOM_ID, 1);
    const refetching = queryClient.refetchQueries({
      queryKey: roomSchedulesQueryKey(ROOM_ID),
      exact: true,
    });
    const hydratedPlaces = [placeholder("a", 100)];
    queryClient.setQueryData(scheduleItemsQueryKey(ROOM_ID, 1), hydratedPlaces);
    finishHydrations[1]([schedule(1, ["a"])]);
    await refetching;

    await expect(enriching).resolves.toBe(hydratedPlaces);
    expect(finishHydrations).toHaveLength(2);
    expect(requestPlacePreviewsBatch).not.toHaveBeenCalled();
    expect(requestPlacePreview).not.toHaveBeenCalled();
  });

  it("불러오기가 끝난 뒤 다시 들어오면 자리표시자인 장소만 다시 받는다", async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(roomSchedulesQueryKey(ROOM_ID), [schedule(1, ["a", "b"])]);
    queryClient.setQueryData(scheduleItemsQueryKey(ROOM_ID, 1), [placeholder("a", 100)]);
    queryClient.setQueryData(placePreviewQueryKey("b"), {
      googlePlaceId: "b",
      name: "이름 b",
      formattedAddress: "서울",
    });
    requestPlacePreview.mockResolvedValueOnce({
      googlePlaceId: "a",
      name: "이름 a",
      formattedAddress: "서울",
      location: { latitude: 37.5, longitude: 127.0 },
      primaryType: "cafe",
      primaryTypeDisplayName: "카페",
    });

    const places = await ensureSchedulePlanPlacesEnriched(queryClient, ROOM_ID, 1);

    expect(places.map((place) => place.title)).toEqual(["이름 a", "이름 b"]);
    expect(requestPlacePreview).toHaveBeenCalledExactlyOnceWith("a");
    expect(requestPlacePreviewsBatch).not.toHaveBeenCalled();
  });
});
