import type { QueryClient } from "@tanstack/react-query";

import type { RoomScheduleItem } from "@/lib/api/rooms/schedule-items";
import {
  clearPersistedScheduleRoutesForSchedule,
  clearPersistedScheduleRoutesForSegmentSources,
} from "@/lib/plan/planTravelLocalStorage";
import { usePlanMapDirectionsEpochStore } from "@/stores/plan-map-directions-epoch-store";
import type { PlanPlace } from "@/lib/plan/types";
import { scheduleItemsQueryKey } from "@/lib/query-keys";

function asOrderedItemIds(places: unknown): number[] | null {
  if (!Array.isArray(places)) return null;
  const out: number[] = [];
  for (const p of places) {
    const row = p as PlanPlace;
    if (typeof row?.itemId === "number" && Number.isFinite(row.itemId)) {
      out.push(row.itemId);
    }
  }
  return out.length > 0 || places.length === 0 ? out : null;
}

/** `schedule-items` 캐시의 `PlanPlace[]`에서 순서대로 `itemId`를 뽑습니다. */
export function readOrderedItemIdsFromScheduleItemsCache(
  queryClient: QueryClient,
  roomId: string,
  scheduleId: number,
): number[] | null {
  const data = queryClient.getQueryData<PlanPlace[]>(
    scheduleItemsQueryKey(roomId, scheduleId),
  );
  return asOrderedItemIds(data ?? null);
}

/** `PlanPlace[]` → 순서대로 `itemId` 목록 */
export function orderedItemIdsFromPlanPlaces(
  places: readonly PlanPlace[],
): number[] {
  return asOrderedItemIds(places) ?? [];
}

/**
 * 재조회 전후 순서를 비교해 다음 장소가 바뀐 구간의 출발 `itemId`를 모읍니다.
 * 이전 캐시가 없으면 받아 둔 구간 경로도 없으므로 비웁니다.
 */
export function segmentSourcesWithChangedNext(
  before: number[] | null,
  after: number[],
): number[] {
  if (!before) return [];
  const nextOf = (ids: number[]) =>
    new Map<number, number | undefined>(ids.map((id, i) => [id, ids[i + 1]]));
  const beforeNext = nextOf(before);
  const afterNext = nextOf(after);
  const changed = new Set<number>();
  for (const [id, next] of beforeNext) {
    if (afterNext.get(id) !== next) changed.add(id);
  }
  for (const [id, next] of afterNext) {
    if (beforeNext.get(id) !== next) changed.add(id);
  }
  return [...changed];
}

/** 리오더 API 응답 `RoomScheduleItem[]` → `orderIndex` 순 `itemId` 목록 */
export function orderedItemIdsFromRoomScheduleItems(
  items: RoomScheduleItem[],
): number[] {
  return [...items]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((it) => it.itemId)
    .filter((id): id is number => typeof id === "number" && Number.isFinite(id));
}

/** 항목 `itemId`에 인접한 구간의 출발 `segmentSourceItemId` (최대 prev, 자신). */
function segmentSourcesTouchingItem(
  orderedItemIds: number[],
  itemId: number,
): Set<number> {
  const s = new Set<number>();
  const i = orderedItemIds.indexOf(itemId);
  if (i < 0) return s;
  if (i > 0) s.add(orderedItemIds[i - 1]!);
  if (i < orderedItemIds.length - 1) s.add(orderedItemIds[i]!);
  return s;
}

export function collectSegmentSourcesForCreate(
  newOrderedIds: number[] | null,
  itemId: number,
): { sources: number[]; useFallback: boolean } {
  if (!newOrderedIds?.length) {
    return { sources: [], useFallback: true };
  }
  if (newOrderedIds.indexOf(itemId) < 0) {
    return { sources: [], useFallback: true };
  }
  return {
    sources: [...segmentSourcesTouchingItem(newOrderedIds, itemId)],
    useFallback: false,
  };
}

export function removeRouteQueriesForDeletedItemSource(
  queryClient: QueryClient,
  roomId: string,
  scheduleId: number,
  itemId: number,
): void {
  const rid = roomId.trim();
  queryClient.removeQueries({
    predicate: (q) => {
      const key = q.queryKey;
      if (!Array.isArray(key) || key[0] !== "schedule-item-route") {
        return false;
      }
      if (String(key[1] ?? "").trim() !== rid) return false;
      if (key[2] !== scheduleId) return false;
      return key[3] === itemId;
    },
  });
}

export function collectSegmentSourcesForDelete(
  oldOrderedIds: number[] | null,
  deletedItemId: number,
): { sources: number[]; useFallback: boolean } {
  if (!oldOrderedIds?.length) {
    return { sources: [], useFallback: true };
  }
  const i = oldOrderedIds.indexOf(deletedItemId);
  if (i < 0) {
    return { sources: [], useFallback: true };
  }
  if (i === 0) {
    return { sources: [], useFallback: false };
  }
  return { sources: [oldOrderedIds[i - 1]!], useFallback: false };
}

export function collectSegmentSourcesForReorder(
  oldOrderedIds: number[] | null,
  newOrderedIds: number[] | null,
  itemId: number,
): { sources: number[]; useFallback: boolean } {
  if (!newOrderedIds?.length) {
    return { sources: [], useFallback: true };
  }
  if (newOrderedIds.indexOf(itemId) < 0) {
    return { sources: [], useFallback: true };
  }
  const s = new Set(segmentSourcesTouchingItem(newOrderedIds, itemId));
  if (oldOrderedIds?.length) {
    segmentSourcesTouchingItem(oldOrderedIds, itemId).forEach((id) =>
      s.add(id),
    );
  }
  return { sources: [...s], useFallback: false };
}

export function bumpPlanMapRouteSegments(
  roomId: string,
  scheduleId: number,
  sourceItemIds: number[],
): void {
  if (sourceItemIds.length === 0) return;
  const rid = roomId.trim();
  if (!rid.length) return;
  usePlanMapDirectionsEpochStore.getState().bumpSegments(
    rid,
    sourceItemIds.map((segmentSourceItemId) => ({
      scheduleId,
      segmentSourceItemId,
    })),
  );
}

/** 항목 삭제 직후 — 삭제 전 순서 스냅샷 기준 인접 구간 route만 무효화(본인 mutation). */
export async function invalidateScheduleItemRoutesAfterDelete(
  queryClient: QueryClient,
  roomId: string,
  scheduleId: number,
  deletedItemId: number,
  oldOrderedIds: number[] | null,
): Promise<void> {
  const rid = roomId.trim();
  if (!rid.length) return;
  const { sources, useFallback } = collectSegmentSourcesForDelete(
    oldOrderedIds,
    deletedItemId,
  );
  if (useFallback) {
    await invalidateScheduleItemRouteForWholeSchedule(queryClient, rid, scheduleId);
    usePlanMapDirectionsEpochStore.getState().bumpForDirections(rid);
    return;
  }
  await invalidateScheduleItemRouteForSources(queryClient, rid, scheduleId, sources);
  bumpPlanMapRouteSegments(rid, scheduleId, sources);
}

/** 항목 생성 후 캐시 반영 직후 — 인접 구간 route만 무효화(본인 mutation). */
export async function invalidateScheduleItemRoutesAfterItemCreated(
  queryClient: QueryClient,
  roomId: string,
  scheduleId: number,
  itemId: number,
): Promise<void> {
  const rid = roomId.trim();
  if (!rid.length) return;
  const orderedIds = readOrderedItemIdsFromScheduleItemsCache(
    queryClient,
    rid,
    scheduleId,
  );
  const { sources, useFallback } = collectSegmentSourcesForCreate(
    orderedIds,
    itemId,
  );
  if (useFallback) {
    await invalidateScheduleItemRouteForWholeSchedule(queryClient, rid, scheduleId);
    usePlanMapDirectionsEpochStore.getState().bumpForDirections(rid);
    return;
  }
  await invalidateScheduleItemRouteForSources(queryClient, rid, scheduleId, sources);
  bumpPlanMapRouteSegments(rid, scheduleId, sources);
}

/**
 * 리오더·중간 삽입 직후 — STOMP보다 먼저 캐시·서버 순서를 알 때 구간만 무효화.
 * `oldOrderedIds`는 merge 전 `schedule-items` 스냅샷, `items`는 리오더(또는 최종 PATCH) 응답.
 */
export async function invalidateScheduleItemRoutesAfterReorder(
  queryClient: QueryClient,
  roomId: string,
  scheduleId: number,
  movedItemId: number,
  oldOrderedIds: number[] | null,
  items: RoomScheduleItem[],
): Promise<void> {
  const rid = roomId.trim();
  if (!rid.length) return;
  const newOrderedIds = orderedItemIdsFromRoomScheduleItems(items);
  const { sources, useFallback } = collectSegmentSourcesForReorder(
    oldOrderedIds,
    newOrderedIds,
    movedItemId,
  );
  if (useFallback) {
    await invalidateScheduleItemRouteForWholeSchedule(queryClient, rid, scheduleId);
    usePlanMapDirectionsEpochStore.getState().bumpForDirections(rid);
    return;
  }
  await invalidateScheduleItemRouteForSources(queryClient, rid, scheduleId, sources);
  bumpPlanMapRouteSegments(rid, scheduleId, sources);
}

export async function invalidateScheduleItemRouteForSources(
  queryClient: QueryClient,
  roomId: string,
  scheduleId: number,
  sourceItemIds: number[],
): Promise<void> {
  if (sourceItemIds.length === 0) return;
  const rid = roomId.trim();
  clearPersistedScheduleRoutesForSegmentSources(rid, scheduleId, sourceItemIds);
  const want = new Set(sourceItemIds);
  await queryClient.invalidateQueries({
    predicate: (q) => {
      const key = q.queryKey;
      if (!Array.isArray(key) || key[0] !== "schedule-item-route") {
        return false;
      }
      if (String(key[1] ?? "").trim() !== rid) return false;
      if (key[2] !== scheduleId) return false;
      return typeof key[3] === "number" && want.has(key[3]);
    },
    /** `all`이면 옵저버 없는 캐시(재정렬로 구간이 사라진 뒤)도 refetch되어 모드 4개가 동시에 나감 */
    refetchType: "active",
  });
}

export async function invalidateScheduleItemRouteForWholeSchedule(
  queryClient: QueryClient,
  roomId: string,
  scheduleId: number,
): Promise<void> {
  const rid = roomId.trim();
  clearPersistedScheduleRoutesForSchedule(rid, scheduleId);
  await queryClient.invalidateQueries({
    predicate: (q) => {
      const key = q.queryKey;
      if (!Array.isArray(key) || key[0] !== "schedule-item-route") {
        return false;
      }
      if (String(key[1] ?? "").trim() !== rid) return false;
      return key[2] === scheduleId;
    },
    refetchType: "active",
  });
}
