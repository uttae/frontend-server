import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { awaitRoomSchedulesHydrated } from "@/lib/rooms";

import {
  createScheduleItem,
  getScheduleItems,
  updateScheduleItem,
  type CreateScheduleItemResponse,
  type RoomScheduleItem,
} from "@/lib/api/rooms/schedule-items";
import { fetchPlacePreview } from "@/lib/places/place-queries";
import {
  buildPlanPlacesFromItemsWithPreviewEnrichment,
  resolveScheduleItemsFromCacheOrHydrate,
} from "@/lib/plan/schedule-bulk-hydration";
import { getQueryClient } from "@/lib/query-client";
import {
  bumpPlanMapRouteSegments,
  invalidateScheduleItemRouteForSources,
  invalidateScheduleItemRouteForWholeSchedule,
  invalidateScheduleItemRoutesAfterDelete,
  invalidateScheduleItemRoutesAfterItemCreated,
  invalidateScheduleItemRoutesAfterReorder,
  readOrderedItemIdsFromScheduleItemsCache,
  removeRouteQueriesForDeletedItemSource,
} from "@/lib/plan/scheduleStompRouteScope";
import { roomSchedulesQueryKey, scheduleItemsQueryKey } from "@/lib/query-keys";
import {
  addMinutesToHm,
  computeDurationMinutesFromRange,
  hmToMinutesSinceMidnight,
  minutesSinceMidnightToHm,
  normalizeStartTimeToHm,
} from "@/lib/plan/scheduleTime";
import type { PlanPlace } from "@/lib/plan/types";
import { usePlanMapDirectionsEpochStore } from "@/stores/plan-map-directions-epoch-store";

/** `orderIndex` 기준 정렬(비변형) */
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
  /** PATCH body에 `memo`가 포함된 경우 — 응답에서 필드가 생략돼도 삭제 반영 */
  memoTouched?: boolean;
};

/** PATCH 응답 — `memo` 키가 없으면 기존 캐시 메모 유지(시간만 수정 등) */
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

/**
 * 리오더 등으로 서버 `RoomScheduleItem[]`만 바뀐 경우, 캐시된 PlanPlace의
 * 제목·location 등은 유지하고 순서·시간·수단만 반영합니다.
 * 항목 1개 추가(+1)는 신규 항목만 Preview enrich.
 * 항목 1개 삭제(-1)는 기존 PlanPlace 유지·순서·시간만 패치(Preview 없음).
 * 그 외 길이/집합 불일치는 null → 전체 재조회.
 */
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

/**
 * 일차 장소 목록을 씁니다. 그사이 일정 전체 재조회가 진행 중이면 그 응답은 이 변경 전 스냅샷이라
 * 끝나는 대로 방금 쓴 일차를 되돌립니다. 진행 중인 조회를 취소하고 다시 받게 합니다.
 */
export function setSchedulePlanPlaces(
  queryClient: QueryClient,
  roomId: string,
  scheduleId: number,
  places: PlanPlace[],
): void {
  const rid = roomId.trim();
  queryClient.setQueryData(scheduleItemsQueryKey(rid, scheduleId), places);

  const roomSchedulesKey = roomSchedulesQueryKey(rid);
  if (queryClient.isFetching({ queryKey: roomSchedulesKey, exact: true }) > 0) {
    void queryClient.refetchQueries({ queryKey: roomSchedulesKey, exact: true });
  }
}

/** DELETE 직후 `schedule-items`에서 항목만 제거(Preview·Photo 재조회 없음). */
export function removeScheduleItemFromPlanPlacesCache(
  queryClient: QueryClient,
  roomId: string,
  scheduleId: number,
  deletedItemId: number,
): boolean {
  const rid = roomId.trim();
  if (!rid.length) return false;
  const key = scheduleItemsQueryKey(rid, scheduleId);
  const prev = queryClient.getQueryData<PlanPlace[]>(key);
  if (!prev?.length) return false;
  const next = prev.filter((p) => p.itemId !== deletedItemId);
  if (next.length === prev.length) return false;
  setSchedulePlanPlaces(queryClient, rid, scheduleId, next);
  return true;
}

/** 본인 DELETE mutation 직후 — 캐시 패치·삭제 구간 route·쿼리 정리 */
export async function applyScheduleItemDeletedOnClient(
  queryClient: QueryClient,
  roomId: string,
  scheduleId: number,
  deletedItemId: number,
): Promise<void> {
  const rid = roomId.trim();
  if (!rid.length) return;

  const oldIds = readOrderedItemIdsFromScheduleItemsCache(
    queryClient,
    rid,
    scheduleId,
  );
  removeScheduleItemFromPlanPlacesCache(
    queryClient,
    rid,
    scheduleId,
    deletedItemId,
  );
  removeRouteQueriesForDeletedItemSource(
    queryClient,
    rid,
    scheduleId,
    deletedItemId,
  );
  await invalidateScheduleItemRoutesAfterDelete(
    queryClient,
    rid,
    scheduleId,
    deletedItemId,
    oldIds,
  );
}

/**
 * STOMP·뮤테이션 동기화: 그 일차 장소 목록을 서버에서 다시 받게 합니다. 보는 화면이 있으면 바로 받고,
 * 없으면 다시 받을 목록으로 표시해 두었다가 그 화면에 들어갈 때 받습니다.
 * 같은 일차를 받는 중이면 그 조회는 이 변경 전에 보낸 요청이라 취소하고 새로 받습니다(늦게 온 옛 응답은 버려짐).
 * 다시 받지 못하면 throw합니다 — 호출부는 목록이 바뀐 뒤에만 경로를 무효화합니다.
 */
export async function invalidateSchedulePlanPlaces(
  queryClient: QueryClient,
  roomId: string,
  scheduleId: number,
): Promise<void> {
  const queryKey = scheduleItemsQueryKey(roomId.trim(), scheduleId);
  // 목록이 아직 없으면 TanStack은 진행 중인 첫 조회를 취소하지 않고 합류만 한다
  const state = queryClient.getQueryState(queryKey);
  if (state?.data === undefined && state?.fetchStatus === "fetching") {
    await queryClient.cancelQueries({ queryKey, exact: true });
  }
  await queryClient.invalidateQueries(
    { queryKey, exact: true },
    { throwOnError: true },
  );
}

/**
 * `reorderScheduleItem` 응답(`RoomScheduleItem[]`)으로 캐시된 PlanPlace를 갱신하고,
 * 머지 불가 시에만 전체 enrich를 다시 가져옵니다.
 */
export async function mergeOrRefetchSchedulePlanPlacesFromItems(
  queryClient: QueryClient,
  roomId: string,
  scheduleId: number,
  items: RoomScheduleItem[],
): Promise<void> {
  const rid = roomId.trim();
  if (!rid.length) return;
  const key = scheduleItemsQueryKey(rid, scheduleId);
  const prev = queryClient.getQueryData<PlanPlace[]>(key);
  const merged = await mergeScheduleItemsIntoPlanPlaces(prev, items);
  if (merged) {
    setSchedulePlanPlaces(queryClient, rid, scheduleId, merged);
    return;
  }
  const places = await buildPlanPlacesFromScheduleItems(items);
  setSchedulePlanPlaces(queryClient, rid, scheduleId, places);
}

/** cross-day item 이동 후 source/target 일차 items·route 캐시 동기화 */
export async function syncAfterCrossScheduleItemMove(
  queryClient: QueryClient,
  roomId: string,
  sourceScheduleId: number,
  targetScheduleId: number,
  movedItemId?: number,
  affectedRouteItemIds?: number[] | null,
): Promise<void> {
  const rid = roomId.trim();
  if (!rid.length) return;

  const scheduleIds =
    sourceScheduleId === targetScheduleId
      ? [sourceScheduleId]
      : [sourceScheduleId, targetScheduleId];

  const oldSourceOrderedIds =
    movedItemId != null
      ? readOrderedItemIdsFromScheduleItemsCache(
          queryClient,
          rid,
          sourceScheduleId,
        )
      : null;

  for (const sid of scheduleIds) {
    await invalidateSchedulePlanPlaces(queryClient, rid, sid);
  }

  if (affectedRouteItemIds !== undefined) {
    if (affectedRouteItemIds === null) {
      for (const sid of scheduleIds) {
        await invalidateScheduleItemRouteForWholeSchedule(queryClient, rid, sid);
      }
      usePlanMapDirectionsEpochStore.getState().bumpForDirections(rid);
      return;
    }

    const remaining = new Set(affectedRouteItemIds);
    for (const sid of scheduleIds) {
      const orderedIds = readOrderedItemIdsFromScheduleItemsCache(
        queryClient,
        rid,
        sid,
      );
      const scheduleItemIds = new Set(orderedIds ?? []);
      const sources = affectedRouteItemIds.filter(
        (id) => remaining.has(id) && scheduleItemIds.has(id),
      );
      for (const id of sources) remaining.delete(id);
      await invalidateScheduleItemRouteForSources(
        queryClient,
        rid,
        sid,
        sources,
      );
      bumpPlanMapRouteSegments(rid, sid, sources);
    }

    if (remaining.size > 0) {
      for (const sid of scheduleIds) {
        await invalidateScheduleItemRouteForWholeSchedule(queryClient, rid, sid);
      }
      usePlanMapDirectionsEpochStore.getState().bumpForDirections(rid);
    }
    return;
  }

  if (movedItemId != null) {
    await invalidateScheduleItemRoutesAfterDelete(
      queryClient,
      rid,
      sourceScheduleId,
      movedItemId,
      oldSourceOrderedIds,
    );
    await invalidateScheduleItemRoutesAfterItemCreated(
      queryClient,
      rid,
      targetScheduleId,
      movedItemId,
    );
    return;
  }

  for (const sid of scheduleIds) {
    await invalidateScheduleItemRouteForWholeSchedule(queryClient, rid, sid);
  }

  usePlanMapDirectionsEpochStore.getState().bumpForDirections(rid);
}

/**
 * 그 일차 항목을 서버에서 받아 캐시된 장소의 이름·주소와 합칩니다. 캐시는 TanStack이 씁니다.
 * 같은 일차 조회가 겹치면 TanStack이 옛 조회를 취소하고 그 응답을 버립니다.
 */
async function fetchSchedulePlanPlaces(
  queryClient: QueryClient,
  roomId: string,
  scheduleId: number,
  signal: AbortSignal,
): Promise<PlanPlace[]> {
  const items = await getScheduleItems(roomId, scheduleId, signal);
  const prev = queryClient.getQueryData<PlanPlace[]>(
    scheduleItemsQueryKey(roomId, scheduleId),
  );
  return (
    (await mergeScheduleItemsIntoPlanPlaces(prev, items)) ??
    buildPlanPlacesFromItemsWithPreviewEnrichment(queryClient, items)
  );
}

/**
 * `schedule-items` 조회 옵션. 일차 장소 목록을 읽는 곳(일정 목록·지도)은 모두 이 옵션을 쓴다 —
 * 무효화로 다시 받을 때 TanStack은 마지막에 옵션을 넘긴 구독자의 queryFn을 쓰므로, 한 곳이라도
 * 캐시만 읽는 queryFn을 넘기면 서버를 부르지 않게 된다.
 */
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
    // 본인 저장 응답과 STOMP 무효화로만 갱신한다. 화면 밖에서 무효화된 목록은 다시 마운트될 때 받는다
    staleTime: Infinity,
  });
}

/** `schedule-items` 캐시가 있으면 반환, 없으면 room hydrate 후 재시도·최후에만 enrich. */
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

/** 새 항목 POST 시 `startTime` — `HH:mm` (로컬 슬롯: 08:00부터 번호당 1시간, 최대 22:00) */
export function slotStartTimeHm(itemIndex: number): string {
  const hour = Math.min(8 + itemIndex, 22);
  return `${String(hour).padStart(2, "0")}:00`;
}

/** 일차 항목들 중 유효한 시작 시각이 가장 이른 `HH:mm` — 리오더 시 1번 칸 기준이 뒷줄로 밀려 올라가지 않도록 앵커로 씁니다. */
function earliestAnchoredHmFromScheduleItems(items: RoomScheduleItem[]): string {
  let minM: number | null = null;
  for (const it of items) {
    const hm = normalizeStartTimeToHm(it.startTime ?? "");
    if (!hm) continue;
    const m = hmToMinutesSinceMidnight(hm);
    if (m === null) continue;
    if (minM === null || m < minM) minM = m;
  }
  if (minM === null) return slotStartTimeHm(0);
  return minutesSinceMidnightToHm(minM);
}

/**
 * 기존 순서 변경 동작을 유지하되, 시각 범위로 계산한 길이만큼 종료도 함께 옮깁니다.
 * 가장 이른 시작을 앵커로 사용하며 미정 종료는 null로 보존합니다.
 */
export function buildChainedStartPatchesForReorder(
  items: RoomScheduleItem[],
): Array<{ itemId: number; startTime: string; endTime: string | null }> {
  const sorted = sortRoomScheduleItemsByOrder(items);
  if (sorted.length === 0) return [];
  let targetHm = earliestAnchoredHmFromScheduleItems(sorted);
  const patches: Array<{
    itemId: number;
    startTime: string;
    endTime: string | null;
  }> = [];
  for (const item of sorted) {
    const duration = computeDurationMinutesFromRange(
      item.startTime ?? "",
      item.endTime ?? "",
    );
    const endTime = duration === null ? null : addMinutesToHm(targetHm, duration);
    if (normalizeStartTimeToHm(item.startTime ?? "") !== targetHm) {
      patches.push({ itemId: item.itemId, startTime: targetHm, endTime });
    }
    targetHm = endTime ?? targetHm;
  }
  return patches;
}

/**
 * 리오더 API 성공 직후: 순서를 캐시에 반영한 뒤, 필요하면 시작 시각 연쇄 PATCH 후 최종 머지.
 */
export async function syncPlanPlacesAfterReorderSuccess(
  queryClient: QueryClient,
  roomId: string,
  scheduleId: number,
  items: RoomScheduleItem[],
  movedItemId: number,
): Promise<void> {
  const rid = roomId.trim();
  if (!rid.length) return;

  const oldOrderedIds = readOrderedItemIdsFromScheduleItemsCache(
    queryClient,
    rid,
    scheduleId,
  );

  await mergeOrRefetchSchedulePlanPlacesFromItems(
    queryClient,
    roomId,
    scheduleId,
    items,
  );

  const patches = buildChainedStartPatchesForReorder(items);
  if (patches.length === 0) {
    await invalidateScheduleItemRoutesAfterReorder(
      queryClient,
      rid,
      scheduleId,
      movedItemId,
      oldOrderedIds,
      items,
    );
    return;
  }

  const snapshot = sortRoomScheduleItemsByOrder(items);
  const byItemId = new Map(snapshot.map((it) => [it.itemId, it]));

  try {
    for (const p of patches) {
      const updated = await updateScheduleItem(rid, scheduleId, p.itemId, {
        startTime: p.startTime,
        endTime: p.endTime,
      });
      byItemId.set(updated.itemId, updated);
    }
  } catch {
    toast.error("순서에 맞게 시작 시간을 바꾸지 못했어요.");
    try {
      const fresh = await getScheduleItems(rid, scheduleId);
      await mergeOrRefetchSchedulePlanPlacesFromItems(
        queryClient,
        roomId,
        scheduleId,
        fresh,
      );
    } catch {
      //
    }
    return;
  }

  const finalItems = sortRoomScheduleItemsByOrder([...byItemId.values()]);
  await mergeOrRefetchSchedulePlanPlacesFromItems(
    queryClient,
    roomId,
    scheduleId,
    finalItems,
  );
  await invalidateScheduleItemRoutesAfterReorder(
    queryClient,
    rid,
    scheduleId,
    movedItemId,
    oldOrderedIds,
    finalItems,
  );
}

/** PATCH 응답 한 건으로 로컬 PlanPlace 캐시만 갱신(같은 목록에 itemId가 있을 때). */
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

/** HTTP 생성 델타를 현재 일정 캐시에 병합합니다. 캐시가 어긋나면 null을 반환합니다. */
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

/** 서버가 지정 위치 삽입과 이동수단 추천을 함께 처리하고 델타를 반환합니다. */
export async function createScheduleItemAtPlanIndex(
  queryClient: QueryClient,
  args: {
    roomId: string;
    scheduleId: number;
    places: PlanPlace[];
    insertIndex: number;
    googlePlaceId: string;
  },
): Promise<RoomScheduleItem> {
  const rid = args.roomId.trim();
  if (!rid.length) {
    throw new Error("createScheduleItemAtPlanIndex: empty roomId");
  }

  const listLengthAfterCreate = args.places.length + 1;
  const targetIndex = resolveInsertTargetIndex(
    args.insertIndex,
    listLengthAfterCreate,
  );
  const response = await createScheduleItem(rid, args.scheduleId, {
    googlePlaceId: args.googlePlaceId,
    orderIndex: targetIndex,
  });

  const key = scheduleItemsQueryKey(rid, args.scheduleId);
  try {
    const prev = queryClient.getQueryData<PlanPlace[]>(key);
    const createdPlace = await planPlaceFromScheduleItem(response.createdItem);
    const merged = mergeCreatedScheduleItemDelta(prev, createdPlace, response);
    if (merged) {
      setSchedulePlanPlaces(queryClient, rid, args.scheduleId, merged);
    } else {
      const fresh = await getScheduleItems(rid, args.scheduleId);
      await mergeOrRefetchSchedulePlanPlacesFromItems(
        queryClient,
        rid,
        args.scheduleId,
        fresh,
      );
    }

    await invalidateScheduleItemRouteForSources(
      queryClient,
      rid,
      args.scheduleId,
      response.affectedRouteItemIds,
    );
    bumpPlanMapRouteSegments(
      rid,
      args.scheduleId,
      response.affectedRouteItemIds,
    );
  } catch {
    await Promise.allSettled([
      queryClient.invalidateQueries({
        queryKey: key,
        exact: true,
        refetchType: "active",
      }),
      invalidateScheduleItemRouteForWholeSchedule(
        queryClient,
        rid,
        args.scheduleId,
      ),
    ]);
    usePlanMapDirectionsEpochStore.getState().bumpForDirections(rid);
  }

  return response.createdItem;
}

/** 드래그를 `toIndex` 자리에 놓았을 때 PATCH에 넣을 `newOrderIndex`(0-based) */
export function newOrderIndexAfterMove(
  fromIndex: number,
  toIndex: number,
  length: number,
): number {
  if (length <= 0 || fromIndex < 0 || toIndex < 0 || fromIndex >= length) {
    return Math.min(Math.max(toIndex, 0), Math.max(length - 1, 0));
  }
  const cappedTo = Math.min(toIndex, length - 1);
  if (fromIndex === cappedTo) return fromIndex;
  const order = Array.from({ length }, (_, i) => i);
  const [moved] = order.splice(fromIndex, 1);
  order.splice(cappedTo, 0, moved);
  return order.indexOf(moved);
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
