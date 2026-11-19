import { queryOptions, type QueryClient } from "@tanstack/react-query";

import { awaitRoomSchedulesHydrated, waitForRoomSchedulesHydration } from "@/lib/rooms";

import {
  createScheduleItem,
  getScheduleItems,
  type CreateScheduleItemResponse,
  type RoomScheduleItem,
} from "@/lib/api/rooms/schedule-items";
import {
  fetchAndSeedPlacePreviews,
  reconcileSchedulePlanPlacesAfterPreviewSeed,
} from "@/lib/places/place-batch-cache";
import { fetchPlacePreview } from "@/lib/places/place-queries";
import {
  buildPlanPlacesFromItemsWithPreviewEnrichment,
  PLAN_PLACE_PREVIEW_ERROR_TITLE,
  planPlacesNeedPreviewEnrich,
  resolveScheduleItemsFromCacheOrHydrate,
} from "@/lib/plan/schedule-bulk-hydration";
import { getQueryClient } from "@/lib/query-client";
import { scheduleItemsQueryKey } from "@/lib/query-keys";
import type { PlanPlace } from "@/lib/plan/types";

export function sortRoomScheduleItemsByOrder(
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

type ApplyScheduleItemPatchOptions = {
  memoTouched?: boolean;
};

function memoFromScheduleItemPatch(
  existing: PlanPlace,
  updated: RoomScheduleItem,
  options?: ApplyScheduleItemPatchOptions,
): string | undefined {
  if (options?.memoTouched) {
    return memoFromScheduleItem(updated);
  }
  if (!Object.prototype.hasOwnProperty.call(updated, "memo")) {
    return existing.memo;
  }
  return memoFromScheduleItem(updated);
}

function patchPlanPlaceFromScheduleItem(
  existing: PlanPlace,
  item: RoomScheduleItem,
): PlanPlace {
  const hasServerStart =
    typeof item.startTime === "string" && item.startTime.trim().length > 0;
  const hasServerEnd =
    typeof item.endTime === "string" && item.endTime.length > 0;
  const next: PlanPlace = {
    ...existing,
    googlePlaceId: item.googlePlaceId,
    travelMode: item.travelMode,
    memo: memoFromScheduleItem(item),
  };
  if (item.startTime === null) {
    delete next.startTime;
  } else if (hasServerStart) {
    next.startTime = item.startTime;
  }
  if (item.endTime === null) {
    delete next.endTime;
  } else if (hasServerEnd) {
    next.endTime = item.endTime;
  }
  return next;
}

async function mergeScheduleItemsIntoPlanPlaces(
  prev: PlanPlace[] | undefined,
  items: RoomScheduleItem[],
): Promise<PlanPlace[] | null> {
  if (!prev || prev.length === 0) return null;

  const prevWithId = prev.filter(
    (p): p is PlanPlace & { itemId: number } => typeof p.itemId === "number",
  );
  if (prevWithId.length !== prev.length) return null;

  const byId = new Map<number, PlanPlace>();
  for (const p of prevWithId) {
    byId.set(p.itemId, p);
  }
  if (byId.size !== prevWithId.length) return null;

  const sorted = sortRoomScheduleItemsByOrder(items);
  const allowOneNewItem = items.length === prev.length + 1;
  const allowOneDelete = items.length === prev.length - 1;

  if (items.length !== prev.length && !allowOneNewItem && !allowOneDelete) {
    return null;
  }

  if (allowOneNewItem) {
    const newItems = sorted.filter((item) => !byId.has(item.itemId));
    if (newItems.length !== 1) return null;
  }

  if (allowOneDelete) {
    const itemIdSet = new Set(sorted.map((item) => item.itemId));
    let removedFromPrev = 0;
    for (const id of byId.keys()) {
      if (!itemIdSet.has(id)) removedFromPrev += 1;
    }
    if (removedFromPrev !== 1) return null;
    for (const item of sorted) {
      if (!byId.has(item.itemId)) return null;
    }
  }

  const out: PlanPlace[] = [];
  for (const item of sorted) {
    const existing = byId.get(item.itemId);
    if (existing) {
      out.push(patchPlanPlaceFromScheduleItem(existing, item));
      continue;
    }
    if (allowOneNewItem) {
      out.push(await planPlaceFromScheduleItem(item));
      continue;
    }
    return null;
  }
  return out;
}

async function buildPlanPlacesFromScheduleItems(
  items: RoomScheduleItem[],
): Promise<PlanPlace[]> {
  const qc = getQueryClient();
  if (qc) {
    return buildPlanPlacesFromItemsWithPreviewEnrichment(qc, items);
  }

  const sorted = sortRoomScheduleItemsByOrder(items);
  return Promise.all(sorted.map((item) => planPlaceFromScheduleItem(item)));
}

export function removeScheduleItemFromPlanPlacesCache(
  queryClient: QueryClient,
  roomId: string,
  scheduleId: number,
  deletedItemId: number,
): void {
  queryClient.setQueryData<PlanPlace[]>(
    scheduleItemsQueryKey(roomId.trim(), scheduleId),
    (old) => old?.filter((p) => p.itemId !== deletedItemId),
  );
}

export async function invalidateSchedulePlanPlaces(
  queryClient: QueryClient,
  roomId: string,
  scheduleId: number,
): Promise<void> {
  const queryKey = scheduleItemsQueryKey(roomId.trim(), scheduleId);
  const state = queryClient.getQueryState(queryKey);
  if (state?.data === undefined && state?.fetchStatus === "fetching") {
    await queryClient.cancelQueries({ queryKey, exact: true });
  }
  await queryClient.invalidateQueries({ queryKey, exact: true }, { throwOnError: true });
}

export async function syncAfterCrossScheduleItemMove(
  queryClient: QueryClient,
  roomId: string,
  sourceScheduleId: number,
  targetScheduleId: number,
): Promise<void> {
  const rid = roomId.trim();
  if (!rid.length) return;

  await invalidateSchedulePlanPlaces(queryClient, rid, sourceScheduleId);
  if (targetScheduleId !== sourceScheduleId) {
    await invalidateSchedulePlanPlaces(queryClient, rid, targetScheduleId);
  }
}

export async function ensureSchedulePlanPlacesEnriched(
  queryClient: QueryClient,
  roomId: string,
  scheduleId: number,
): Promise<PlanPlace[]> {
  const rid = roomId.trim();
  if (!rid.length) return [];
  const key = scheduleItemsQueryKey(rid, scheduleId);
  const waitedForHydration = await waitForRoomSchedulesHydration(queryClient, rid);
  const cached = queryClient.getQueryData<PlanPlace[]>(key);
  if (cached != null && (waitedForHydration || !planPlacesNeedPreviewEnrich(cached))) {
    return cached;
  }
  if (cached != null) {
    const placeholderIds = cached
      .filter((place) => place.title === PLAN_PLACE_PREVIEW_ERROR_TITLE)
      .flatMap((place) => (place.googlePlaceId ? [place.googlePlaceId] : []));
    await fetchAndSeedPlacePreviews(placeholderIds, queryClient);
    reconcileSchedulePlanPlacesAfterPreviewSeed(queryClient, rid);
    return queryClient.getQueryData<PlanPlace[]>(key) ?? cached;
  }

  const items = await resolveScheduleItemsFromCacheOrHydrate(
    queryClient,
    rid,
    scheduleId,
  );
  const places = await buildPlanPlacesFromItemsWithPreviewEnrichment(
    queryClient,
    items,
  );
  queryClient.setQueryData(key, places);
  return places;
}

async function fetchSchedulePlanPlaces(
  queryClient: QueryClient,
  roomId: string,
  scheduleId: number,
  signal: AbortSignal,
): Promise<PlanPlace[]> {
  const key = scheduleItemsQueryKey(roomId, scheduleId);
  const state = queryClient.getQueryState<PlanPlace[]>(key);
  if (!state?.isInvalidated && state?.data && planPlacesNeedPreviewEnrich(state.data)) {
    return ensureSchedulePlanPlacesEnriched(queryClient, roomId, scheduleId);
  }
  const items = await getScheduleItems(roomId, scheduleId, signal);
  const prev = queryClient.getQueryData<PlanPlace[]>(
    scheduleItemsQueryKey(roomId, scheduleId),
  );
  return (
    (await mergeScheduleItemsIntoPlanPlaces(prev, items)) ??
    buildPlanPlacesFromItemsWithPreviewEnrichment(queryClient, items)
  );
}

export function schedulePlanPlacesQueryOptions(
  queryClient: QueryClient,
  roomId: string,
  scheduleId: number | null,
) {
  const rid = roomId.trim();
  return queryOptions({
    queryKey: scheduleItemsQueryKey(rid || null, scheduleId),
    queryFn: async ({ signal }): Promise<PlanPlace[]> =>
      rid.length > 0 && scheduleId !== null
        ? fetchSchedulePlanPlaces(queryClient, rid, scheduleId, signal)
        : [],
    staleTime: Infinity,
    refetchOnMount: (query) => {
      const data = query.state.data;
      return data && planPlacesNeedPreviewEnrich(data) ? "always" : true;
    },
  });
}

export async function fetchSchedulePlanPlacesFromCacheOrApi(
  roomId: string,
  scheduleId: number,
  queryClient?: QueryClient | null,
): Promise<PlanPlace[]> {
  const rid = roomId.trim();
  if (!rid.length) return [];
  const qc = queryClient ?? getQueryClient();
  const key = scheduleItemsQueryKey(rid, scheduleId);

  if (qc) {
    const cached = qc.getQueryData<PlanPlace[]>(key);
    if (cached != null) return cached;

    await awaitRoomSchedulesHydrated(qc, rid);

    const afterHydrate = qc.getQueryData<PlanPlace[]>(key);
    if (afterHydrate != null) return afterHydrate;
  }

  return fetchScheduleItemsAsPlanPlaces(rid, scheduleId);
}

export function applyRoomScheduleItemToPlanPlaces(
  prev: PlanPlace[] | undefined,
  updated: RoomScheduleItem,
  options?: ApplyScheduleItemPatchOptions,
): PlanPlace[] | null {
  if (!prev || prev.length === 0) return null;
  let found = false;
  const out = prev.map((p) => {
    if (p.itemId !== updated.itemId) return p;
    found = true;
    const hasServerStart =
      typeof updated.startTime === "string" &&
      updated.startTime.trim().length > 0;
    const hasServerEnd =
      typeof updated.endTime === "string" && updated.endTime.length > 0;
    const next: PlanPlace = {
      ...p,
      googlePlaceId: updated.googlePlaceId,
      travelMode: updated.travelMode,
      memo: memoFromScheduleItemPatch(p, updated, options),
    };
    if (updated.startTime === null) {
      delete next.startTime;
    } else if (hasServerStart) {
      next.startTime = updated.startTime;
    }
    if (updated.endTime === null) {
      delete next.endTime;
    } else if (hasServerEnd) {
      next.endTime = updated.endTime;
    }
    return next;
  });
  return found ? out : null;
}

async function planPlaceFromScheduleItem(
  item: RoomScheduleItem,
): Promise<PlanPlace> {
  try {
    const preview = await fetchPlacePreview(item.googlePlaceId);
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
  } catch {
    return {
      id: `item-${item.itemId}`,
      itemId: item.itemId,
      googlePlaceId: item.googlePlaceId,
      title: "장소 정보를 불러올 수 없음",
      subtitle: item.googlePlaceId,
      startTime: item.startTime ?? undefined,
      endTime: item.endTime ?? undefined,
      travelMode: item.travelMode,
      memo: memoFromScheduleItem(item),
    };
  }
}

function resolveInsertTargetIndex(
  insertIndex: number,
  listLength: number,
): number {
  if (listLength <= 0) return 0;
  if (insertIndex >= listLength) return listLength - 1;
  return Math.max(0, Math.min(insertIndex, listLength - 1));
}

export function mergeCreatedScheduleItemDelta(
  prev: PlanPlace[] | undefined,
  createdPlace: PlanPlace,
  response: CreateScheduleItemResponse,
): PlanPlace[] | null {
  if (!prev || prev.some((place) => place.itemId === response.createdItem.itemId)) {
    return null;
  }

  let next = [...prev];
  for (const updated of response.updatedItems) {
    const patched = applyRoomScheduleItemToPlanPlaces(next, updated);
    if (!patched) return null;
    next = patched;
  }

  const targetIndex = response.createdItem.orderIndex;
  if (
    !Number.isInteger(targetIndex) ||
    targetIndex < 0 ||
    targetIndex > next.length
  ) {
    return null;
  }

  next.splice(targetIndex, 0, createdPlace);
  return next;
}

export function createScheduleItemAtPlanIndex(args: {
  roomId: string;
  scheduleId: number;
  places: PlanPlace[];
  insertIndex: number;
  googlePlaceId: string;
}): Promise<CreateScheduleItemResponse> {
  const rid = args.roomId.trim();
  if (!rid.length) {
    throw new Error("createScheduleItemAtPlanIndex: empty roomId");
  }
  return createScheduleItem(rid, args.scheduleId, {
    googlePlaceId: args.googlePlaceId,
    orderIndex: resolveInsertTargetIndex(args.insertIndex, args.places.length + 1),
  });
}

export async function applyCreatedScheduleItemToPlanPlaces(
  queryClient: QueryClient,
  roomId: string,
  scheduleId: number,
  response: CreateScheduleItemResponse,
): Promise<void> {
  const createdPlace = await planPlaceFromScheduleItem(response.createdItem);
  queryClient.setQueryData<PlanPlace[]>(
    scheduleItemsQueryKey(roomId.trim(), scheduleId),
    (old) => mergeCreatedScheduleItemDelta(old, createdPlace, response) ?? old,
  );
}

export async function fetchScheduleItemsAsPlanPlaces(
  roomId: string,
  scheduleId: number,
): Promise<PlanPlace[]> {
  const rid = roomId.trim();
  if (!rid.length) return [];

  const key = scheduleItemsQueryKey(rid, scheduleId);
  const qc = getQueryClient();
  if (qc) {
    const cached = qc.getQueryData<PlanPlace[]>(key);
    if (cached != null) return cached;

    const items = await resolveScheduleItemsFromCacheOrHydrate(
      qc,
      rid,
      scheduleId,
    );
    const places = await buildPlanPlacesFromScheduleItems(items);
    qc.setQueryData(key, places);
    return places;
  }

  return [];
}
