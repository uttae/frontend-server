import type { QueryClient } from "@tanstack/react-query";

import type { RoomScheduleWithItems } from "@/lib/api/rooms/schedules";
import {
  getScheduleItemRoutesBatch,
  type RoomScheduleItem,
  type ScheduleItemRouteBatchItem,
} from "@/lib/api/rooms/schedule-items";
import { getRoomSchedules } from "@/lib/api/rooms/schedules";
import { isBatchItemOk } from "@/lib/api/batch-types";
import { fetchAndSeedPlacePreviews } from "@/lib/places/place-batch-cache";
import type { PlacePreview } from "@/lib/api/places";
import { placePreviewQueryKey, resolvePreviewGooglePlaceId } from "@/lib/places/place-queries";
import { schedulePlacesFingerprint } from "@/lib/plan/planTravelLocalStorage";
import { sortRoomSchedules } from "@/lib/plan/scheduleMerge";
import { canonicalScheduleTravelMode } from "@/lib/plan/scheduleTravelMode";
import type { PlanPlace } from "@/lib/plan/types";
import { roomSchedulesQueryKey, scheduleItemRouteQueryKey, scheduleItemsQueryKey } from "@/lib/query-keys";
import { awaitRoomSchedulesHydrated } from "@/lib/rooms";

export const PLAN_PLACE_PREVIEW_ERROR_TITLE = "장소 정보를 불러올 수 없음";

export function planPlacesNeedPreviewEnrich(places: readonly PlanPlace[]): boolean {
  return places.some((place) => place.title === PLAN_PLACE_PREVIEW_ERROR_TITLE);
}

export function readScheduleItemsFromRoomCache(
  queryClient: QueryClient,
  roomId: string,
  scheduleId: number,
): RoomScheduleItem[] | null {
  const rid = roomId.trim();
  if (!rid.length) return null;

  const schedules = queryClient.getQueryData<RoomScheduleWithItems[]>(roomSchedulesQueryKey(rid));
  if (!schedules) return null;

  const schedule = schedules.find((s) => s.scheduleId === scheduleId);
  if (!schedule) return null;

  return Array.isArray(schedule.items) ? schedule.items : [];
}

export async function resolveScheduleItemsFromCacheOrHydrate(
  queryClient: QueryClient,
  roomId: string,
  scheduleId: number,
): Promise<RoomScheduleItem[]> {
  const cached = readScheduleItemsFromRoomCache(queryClient, roomId, scheduleId);
  if (cached !== null) return cached;

  await awaitRoomSchedulesHydrated(queryClient, roomId);
  return readScheduleItemsFromRoomCache(queryClient, roomId, scheduleId) ?? [];
}

function sortRoomScheduleItemsByOrder(items: RoomScheduleItem[]): RoomScheduleItem[] {
  return [...items].sort((a, b) => a.orderIndex - b.orderIndex);
}

function memoFromScheduleItem(item: RoomScheduleItem): string | undefined {
  const raw = item.memo;
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function planPlaceFromItemAndPreview(item: RoomScheduleItem, preview: PlacePreview | null): PlanPlace {
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

function readCachedPreview(queryClient: QueryClient, googlePlaceId: string): PlacePreview | null {
  const id = resolvePreviewGooglePlaceId(googlePlaceId);
  if (!id.length) return null;
  const cached = queryClient.getQueryData<PlacePreview>(placePreviewQueryKey(id));
  return cached ?? null;
}

function buildPlanPlacesFromItemsWithCache(queryClient: QueryClient, items: RoomScheduleItem[]): PlanPlace[] {
  const sorted = sortRoomScheduleItemsByOrder(items);
  return sorted.map((item) => planPlaceFromItemAndPreview(item, readCachedPreview(queryClient, item.googlePlaceId)));
}

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

function collectGooglePlaceIdsFromSchedules(schedules: readonly RoomScheduleWithItems[]): string[] {
  const ids = new Set<string>();
  for (const schedule of schedules) {
    for (const item of schedule.items ?? []) {
      const gid = typeof item.googlePlaceId === "string" ? item.googlePlaceId.trim() : "";
      if (gid.length) ids.add(gid);
    }
  }
  return [...ids];
}

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
    placesBySchedule.set(sid, buildPlanPlacesFromItemsWithCache(queryClient, items));
  }
  return placesBySchedule;
}

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

function scheduleRoutesBatchKey(roomId: string, scheduleId: number, placesFingerprint: string): string {
  return `${roomId.trim()}:${scheduleId}:${placesFingerprint}`;
}

function segmentDestinationsByItemId(places: readonly PlanPlace[]): Map<number, number> {
  const out = new Map<number, number>();
  for (let i = 0; i < places.length - 1; i += 1) {
    const itemId = places[i]?.itemId;
    const destination = places[i + 1]?.itemId;
    if (isFiniteItemId(itemId) && isFiniteItemId(destination)) {
      out.set(itemId, destination);
    }
  }
  return out;
}

function isFiniteItemId(id: number | undefined): id is number {
  return typeof id === "number" && Number.isFinite(id);
}

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
    const mode = canonicalScheduleTravelMode(place.travelMode);
    if (!mode) return true;
    const state = queryClient.getQueryState(
      scheduleItemRouteQueryKey(rid, scheduleId, place.itemId, destination, mode),
    );
    return state?.status === "success" && !state.isInvalidated;
  });
}

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

  const promise = hydrateScheduleRoutesBatch(queryClient, rid, scheduleId, places).finally(() => {
    inFlightScheduleRoutesBatch.delete(key);
  });

  inFlightScheduleRoutesBatch.set(key, promise);
  return promise;
}

export async function awaitScheduleRoutesBatch(roomId: string, scheduleId: number): Promise<void> {
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
    const saved = place.travelMode?.trim().toUpperCase() ?? "";
    const mode = canonicalScheduleTravelMode(saved);
    if (!mode) return [];
    return [mode === saved ? { itemId } : { itemId, travelMode: mode }];
  });

  if (!requestItems.length) return;

  const results = await getScheduleItemRoutesBatch(rid, scheduleId, requestItems);

  for (const result of results) {
    const { itemId, toItemId } = result;
    const mode = canonicalScheduleTravelMode(result.travelMode);
    if (!mode || !isFiniteItemId(itemId) || !isFiniteItemId(toItemId)) continue;

    const routeKey = scheduleItemRouteQueryKey(rid, scheduleId, itemId, toItemId, mode);
    if (isBatchItemOk(result)) {
      queryClient.setQueryData(routeKey, batchRouteItemToResponse(result));
    } else if (result.errorCode === "NO_ROUTE") {
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
