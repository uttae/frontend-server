import type { QueryClient } from "@tanstack/react-query";

import type { RoomScheduleWithItems } from "@/lib/api/rooms/schedules";
import {
  getScheduleItemRoutesBatch,
  type RoomScheduleItem,
  type ScheduleItemRouteBatchItem,
} from "@/lib/api/rooms/schedule-items";
import { getRoomSchedules } from "@/lib/api/rooms/schedules";
import { isBatchItemOk } from "@/lib/api/batch-types";
import {
  fetchAndSeedPlacePreviews,
} from "@/lib/places/place-batch-cache";
import type { PlacePreview } from "@/lib/api/places";
import {
  placePreviewQueryKey,
  resolvePreviewGooglePlaceId,
} from "@/lib/places/place-queries";
import { schedulePlacesFingerprint } from "@/lib/plan/planTravelLocalStorage";
import { sortRoomSchedules } from "@/lib/plan/scheduleMerge";
import {
  SCHEDULE_TRAVEL_MODE_DEFAULT,
  canonicalScheduleTravelMode,
} from "@/lib/plan/scheduleTravelMode";
import type { PlanPlace } from "@/lib/plan/types";
import {
  roomSchedulesQueryKey,
  scheduleItemRouteQueryKey,
  scheduleItemsQueryKey,
} from "@/lib/query-keys";
import { awaitRoomSchedulesHydrated } from "@/lib/rooms";

export const PLAN_PLACE_PREVIEW_ERROR_TITLE = "장소 정보를 불러올 수 없음";

export function planPlacesNeedPreviewEnrich(
  places: readonly PlanPlace[],
): boolean {
  return places.some((place) => place.title === PLAN_PLACE_PREVIEW_ERROR_TITLE);
}

/** `includeItems` hydrate 후 room-schedules 캐시에서 일차별 raw items를 읽습니다. */
export function readScheduleItemsFromRoomCache(
  queryClient: QueryClient,
  roomId: string,
  scheduleId: number,
): RoomScheduleItem[] | null {
  const rid = roomId.trim();
  if (!rid.length) return null;

  const schedules = queryClient.getQueryData<RoomScheduleWithItems[]>(
    roomSchedulesQueryKey(rid),
  );
  if (!schedules) return null;

  const schedule = schedules.find((s) => s.scheduleId === scheduleId);
  if (!schedule) return null;

  return Array.isArray(schedule.items) ? schedule.items : [];
}

/** room-schedules 캐시 miss 시 `includeItems` hydrate 후 items를 반환합니다. */
export async function resolveScheduleItemsFromCacheOrHydrate(
  queryClient: QueryClient,
  roomId: string,
  scheduleId: number,
): Promise<RoomScheduleItem[]> {
  const cached = readScheduleItemsFromRoomCache(
    queryClient,
    roomId,
    scheduleId,
  );
  if (cached !== null) return cached;

  await awaitRoomSchedulesHydrated(queryClient, roomId);
  return (
    readScheduleItemsFromRoomCache(queryClient, roomId, scheduleId) ?? []
  );
}

function sortRoomScheduleItemsByOrder(
  items: RoomScheduleItem[],
): RoomScheduleItem[] {
  return [...items].sort((a, b) => a.orderIndex - b.orderIndex);
}

function memoFromScheduleItem(item: RoomScheduleItem): string | undefined {
  const raw = item.memo;
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function planPlaceFromItemAndPreview(
  item: RoomScheduleItem,
  preview: PlacePreview | null,
): PlanPlace {
  if (preview) {
    return {
      id: `item-${item.itemId}`,
      itemId: item.itemId,
      googlePlaceId: item.googlePlaceId,
      location: preview.location,
      title: preview.name,
      subtitle: preview.formattedAddress,
      primaryTypeDisplayName: preview.primaryTypeDisplayName,
      startTime: item.startTime ?? undefined,
      endTime: item.endTime ?? undefined,
      travelMode: item.travelMode,
      memo: memoFromScheduleItem(item),
    };
  }
  return {
    id: `item-${item.itemId}`,
    itemId: item.itemId,
    googlePlaceId: item.googlePlaceId,
    title: PLAN_PLACE_PREVIEW_ERROR_TITLE,
    subtitle: item.googlePlaceId,
    startTime: item.startTime ?? undefined,
    endTime: item.endTime ?? undefined,
    travelMode: item.travelMode,
    memo: memoFromScheduleItem(item),
  };
}

function readCachedPreview(
  queryClient: QueryClient,
  googlePlaceId: string,
): PlacePreview | null {
  const id = resolvePreviewGooglePlaceId(googlePlaceId);
  if (!id.length) return null;
  const cached = queryClient.getQueryData<PlacePreview>(placePreviewQueryKey(id));
  return cached ?? null;
}

function buildPlanPlacesFromItemsWithCache(
  queryClient: QueryClient,
  items: RoomScheduleItem[],
): PlanPlace[] {
  const sorted = sortRoomScheduleItemsByOrder(items);
  return sorted.map((item) =>
    planPlaceFromItemAndPreview(
      item,
      readCachedPreview(queryClient, item.googlePlaceId),
    ),
  );
}

/** preview 캐시 miss 항목만 batch로 받아 채웁니다 — 그래도 없는 장소는 단건으로 다시 받지 않고 자리표시자로 둡니다. */
export async function buildPlanPlacesFromItemsWithPreviewEnrichment(
  queryClient: QueryClient,
  items: RoomScheduleItem[],
): Promise<PlanPlace[]> {
  const placeIds = items
    .map((item) => item.googlePlaceId)
    .filter((id) => typeof id === "string" && id.trim().length > 0);

  if (placeIds.length) {
    await fetchAndSeedPlacePreviews(placeIds, queryClient);
  }
  return buildPlanPlacesFromItemsWithCache(queryClient, items);
}

function collectGooglePlaceIdsFromSchedules(
  schedules: readonly RoomScheduleWithItems[],
): string[] {
  const ids = new Set<string>();
  for (const schedule of schedules) {
    for (const item of schedule.items ?? []) {
      const gid =
        typeof item.googlePlaceId === "string" ? item.googlePlaceId.trim() : "";
      if (gid.length) ids.add(gid);
    }
  }
  return [...ids];
}

/**
 * 일차별 장소 목록을 만들기만 합니다. 미리보기를 기다리는 동안 다른 변경이 들어올 수 있어
 * 캐시 쓰기(`writeSchedulePlacesFromHydrate`)와 나눕니다.
 */
export async function buildSchedulePlacesFromSchedulesWithItems(
  queryClient: QueryClient,
  schedules: readonly RoomScheduleWithItems[],
): Promise<Map<number, PlanPlace[]>> {
  const placeIds = collectGooglePlaceIdsFromSchedules(schedules);
  if (placeIds.length) {
    await fetchAndSeedPlacePreviews(placeIds, queryClient);
  }

  const placesBySchedule = new Map<number, PlanPlace[]>();
  for (const schedule of schedules) {
    const sid = schedule.scheduleId;
    if (typeof sid !== "number" || !Number.isFinite(sid)) continue;

    const items = Array.isArray(schedule.items) ? schedule.items : [];
    placesBySchedule.set(
      sid,
      buildPlanPlacesFromItemsWithCache(queryClient, items),
    );
  }
  return placesBySchedule;
}

/**
 * 만든 일차 목록을 한 번에 씁니다. 경로는 도착 장소까지 key에 있어 순서가 바뀌어도 무효화하지 않습니다.
 * `startedAt`(일정 전체 조회를 보낸 시각) 뒤에 바뀐 일차는 그쪽이 더 새 상태라 덮지 않고,
 * 그 일차를 받는 중이면 이 조회보다 먼저 보낸 요청일 수 있어 다시 받게 합니다.
 */
export function writeSchedulePlacesFromHydrate(
  queryClient: QueryClient,
  roomId: string,
  placesBySchedule: ReadonlyMap<number, PlanPlace[]>,
  startedAt: number,
): void {
  const rid = roomId.trim();
  if (!rid.length) return;

  for (const [sid, places] of placesBySchedule) {
    const key = scheduleItemsQueryKey(rid, sid);
    const state = queryClient.getQueryState(key);
    if (state && state.dataUpdatedAt > startedAt) continue;

    queryClient.setQueryData(key, places);
    if (state?.fetchStatus === "fetching") {
      void queryClient.refetchQueries({ queryKey: key, exact: true });
    }
  }
}

export async function hydrateScheduleItemsFromSchedulesWithItems(
  queryClient: QueryClient,
  roomId: string,
  schedules: readonly RoomScheduleWithItems[],
  startedAt: number,
): Promise<void> {
  const rid = roomId.trim();
  if (!rid.length) return;

  writeSchedulePlacesFromHydrate(
    queryClient,
    rid,
    await buildSchedulePlacesFromSchedulesWithItems(queryClient, schedules),
    startedAt,
  );
}

function batchRouteItemToResponse(
  item: Extract<ScheduleItemRouteBatchItem, { status: "OK" }>,
): import("@/lib/api/rooms/schedule-items").ScheduleItemRouteResponse {
  return {
    distanceMeters: item.distanceMeters,
    durationSeconds: item.durationSeconds,
    travelMode: item.travelMode,
    ...(item.encodedPolyline ? { encodedPolyline: item.encodedPolyline } : {}),
  };
}

const inFlightScheduleRoutesBatch = new Map<string, Promise<void>>();

/**
 * 실패가 아니라 "경로 없음"이라는 답인 batch 항목 — 단건으로 다시 물어도 같은 답(204·404)이 오므로
 * 경로 없음(`null`)으로 시딩하고 다시 묻지 않는다.
 */
const ROUTE_ANSWER_ERROR_CODES = new Set(["NO_ROUTE", "LAST_ITEM", "SCHEDULE_ITEM_NOT_FOUND"]);

/**
 * in-flight dedup 키 — 일정 지문(`itemId` 순서·장소 정체성)을 포함해
 * 목적지만 바뀐 일정(`[A,B]`→`[A,C]`)이 이전 batch Promise를 공유하지 않게 합니다.
 */
function scheduleRoutesBatchKey(
  roomId: string,
  scheduleId: number,
  placesFingerprint: string,
): string {
  return `${roomId.trim()}:${scheduleId}:${placesFingerprint}`;
}

/** 구간 출발 항목 → 다음 장소의 `googlePlaceId` (마지막 장소와 장소 ID가 빈 구간은 뺀다) */
function segmentDestinationsByItemId(places: readonly PlanPlace[]): Map<number, string> {
  const out = new Map<number, string>();
  for (let i = 0; i < places.length - 1; i += 1) {
    const itemId = places[i]?.itemId;
    const destination = places[i + 1]?.googlePlaceId?.trim() ?? "";
    if (typeof itemId === "number" && Number.isFinite(itemId) && destination.length) {
      out.set(itemId, destination);
    }
  }
  return out;
}

/**
 * 일차의 모든 구간 경로가 이미 캐시에 있는지 — 일정 화면에서 받아 뒀거나, 화면을 다시 열었거나,
 * 지도 경로 보기로 넘어온 경우다. 받은 적 없거나(새 순서·gc) 무효화된 구간이 하나라도 있으면 false.
 */
export function scheduleSegmentRoutesCached(
  queryClient: QueryClient,
  roomId: string,
  scheduleId: number,
  places: readonly PlanPlace[],
): boolean {
  const rid = roomId.trim();
  const destinationByItemId = segmentDestinationsByItemId(places);
  if (!rid.length || !destinationByItemId.size) return false;
  return places.every((place) => {
    if (typeof place.itemId !== "number") return true;
    const destination = destinationByItemId.get(place.itemId);
    if (destination === undefined) return true;
    const mode = canonicalScheduleTravelMode(place.travelMode) ?? SCHEDULE_TRAVEL_MODE_DEFAULT;
    const state = queryClient.getQueryState(
      scheduleItemRouteQueryKey(rid, scheduleId, place.itemId, destination, mode),
    );
    return state?.status === "success" && !state.isInvalidated;
  });
}

/**
 * 일차 구간 경로를 저장된 공유 이동수단 기준 batch로 시딩합니다 (in-flight dedup).
 * 모든 구간이 이미 캐시에 있으면 보내지 않는다 — 재마운트·화면 이동만으로 다시 조회하지 않는다.
 */
export async function fetchAndSeedScheduleRoutesBatch(
  queryClient: QueryClient,
  roomId: string,
  scheduleId: number,
  places: readonly PlanPlace[],
): Promise<void> {
  const rid = roomId.trim();
  if (!rid.length || places.length < 2) return;

  const fingerprint = schedulePlacesFingerprint([...places]);
  if (!fingerprint.length) return;

  const key = scheduleRoutesBatchKey(rid, scheduleId, fingerprint);
  const inFlight = inFlightScheduleRoutesBatch.get(key);
  if (inFlight) return inFlight;
  if (scheduleSegmentRoutesCached(queryClient, rid, scheduleId, places)) return;

  const promise = hydrateScheduleRoutesBatch(
    queryClient,
    rid,
    scheduleId,
    places,
  ).finally(() => {
    inFlightScheduleRoutesBatch.delete(key);
  });

  inFlightScheduleRoutesBatch.set(key, promise);
  return promise;
}

/** prefetch 중인 구간 경로 batch가 끝날 때까지 대기합니다. */
export async function awaitScheduleRoutesBatch(
  roomId: string,
  scheduleId: number,
): Promise<void> {
  const rid = roomId.trim();
  if (!rid.length) return;

  const prefix = `${rid}:${scheduleId}:`;
  const pending = [...inFlightScheduleRoutesBatch.entries()]
    .filter(([key]) => key.startsWith(prefix))
    .map(([, promise]) => promise);

  if (pending.length) {
    await Promise.all(pending);
  }
}

/** `travelMode` 생략 batch — 서버가 항목별 저장 이동수단으로 경로를 계산해 실제 사용 수단을 응답 */
export async function hydrateScheduleRoutesBatch(
  queryClient: QueryClient,
  roomId: string,
  scheduleId: number,
  places: readonly PlanPlace[],
): Promise<void> {
  const rid = roomId.trim();
  if (!rid.length || places.length < 2) return;

  const segments = places.slice(0, -1);
  const requestItems = segments.flatMap((place) => {
    const itemId = place.itemId;
    if (typeof itemId !== "number" || !Number.isFinite(itemId)) return [];
    // 저장값이 표준 수단과 다르면(예: 고를 수 없게 된 자전거) 화면에 보이는 수단으로 계산해 달라고 지정한다 —
    // 수단을 빼면 서버가 저장값으로 계산해, 자동차로 보이는 구간에 자전거 경로가 들어간다
    const saved = place.travelMode?.trim().toUpperCase() ?? "";
    const shown = canonicalScheduleTravelMode(saved);
    return [saved && shown && shown !== saved ? { itemId, travelMode: shown } : { itemId }];
  });

  if (!requestItems.length) return;

  const results = await getScheduleItemRoutesBatch(rid, scheduleId, requestItems);

  /**
   * 응답 대기 중 일정이 바뀌었으면(지문 불일치) 늦게 도착한 결과를 버립니다 —
   * 서버는 요청을 받은 순간의 순서로 다음 장소를 정하므로, 그사이 순서가 바뀌었으면 어느 도착 장소의 경로인지 알 수 없다.
   */
  const snapshotFp = schedulePlacesFingerprint([...places]);
  const currentPlaces = queryClient.getQueryData<PlanPlace[]>(
    scheduleItemsQueryKey(rid, scheduleId),
  );
  const currentFp = schedulePlacesFingerprint([...(currentPlaces ?? [])]);
  if (!snapshotFp.length || snapshotFp !== currentFp) return;

  const destinationByItemId = segmentDestinationsByItemId(places);
  for (const result of results) {
    const itemId = result.itemId;
    const mode = canonicalScheduleTravelMode(result.travelMode);
    if (!mode) continue;
    if (typeof itemId !== "number" || !Number.isFinite(itemId)) continue;
    const destination = destinationByItemId.get(itemId);
    if (destination === undefined) continue;

    const routeKey = scheduleItemRouteQueryKey(rid, scheduleId, itemId, destination, mode);
    if (isBatchItemOk(result)) {
      queryClient.setQueryData(routeKey, batchRouteItemToResponse(result));
    } else if (result.errorCode && ROUTE_ANSWER_ERROR_CODES.has(result.errorCode)) {
      queryClient.setQueryData(routeKey, null);
    }
  }
}

export async function hydrateRoomSchedulesWithItems(
  queryClient: QueryClient,
  roomId: string,
): Promise<RoomScheduleWithItems[]> {
  const rid = roomId.trim();
  if (!rid.length) return [];

  const startedAt = Date.now();
  const schedules = await getRoomSchedules(rid, { includeItems: true });
  const sorted = sortRoomSchedules(schedules);
  await hydrateScheduleItemsFromSchedulesWithItems(queryClient, rid, sorted, startedAt);
  return sorted;
}

export { buildPlanPlacesFromItemsWithCache, planPlaceFromItemAndPreview };
