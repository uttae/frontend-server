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

/** DELETE 직후 `schedule-items`에서 항목만 제거(Preview·Photo 재조회 없음). */
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

/**
 * STOMP·뮤테이션 동기화: 그 일차 장소 목록을 서버에서 다시 받게 합니다. 보는 화면이 있으면 바로 받고,
 * 없으면 다시 받을 목록으로 표시해 두었다가 그 화면에 들어갈 때 받습니다.
 * 같은 일차를 받는 중이면 그 조회는 이 변경 전에 보낸 요청이라 취소하고 새로 받습니다(늦게 온 옛 응답은 버려짐).
 * 본인 저장의 반향처럼 받는 중인 조회가 이미 그 변경 뒤에 보낸 것이면 `joinInFlight`로 합류해 요청을 아낍니다.
 * 다시 받지 못하면 throw합니다.
 */
export async function invalidateSchedulePlanPlaces(
  queryClient: QueryClient,
  roomId: string,
  scheduleId: number,
  { joinInFlight = false }: { joinInFlight?: boolean } = {},
): Promise<void> {
  const queryKey = scheduleItemsQueryKey(roomId.trim(), scheduleId);
  // 목록이 아직 없으면 TanStack은 진행 중인 첫 조회를 취소하지 않고 합류만 한다
  const state = queryClient.getQueryState(queryKey);
  if (!joinInFlight && state?.data === undefined && state?.fetchStatus === "fetching") {
    await queryClient.cancelQueries({ queryKey, exact: true });
  }
  await queryClient.invalidateQueries(
    { queryKey, exact: true },
    { throwOnError: true, cancelRefetch: !joinInFlight },
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
  const key = scheduleItemsQueryKey(roomId.trim(), scheduleId);
  queryClient.setQueryData(
    key,
    (await mergeScheduleItemsIntoPlanPlaces(
      queryClient.getQueryData<PlanPlace[]>(key),
      items,
    )) ?? (await buildPlanPlacesFromScheduleItems(items)),
  );
}

/**
 * 다른 일차로 옮긴 뒤 두 일차 장소 목록을 다시 받습니다. 경로는 도착 항목까지 key에 있어
 * 순서가 바뀐 구간은 새 key로 받으므로 따로 무효화하지 않습니다.
 */
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

/** 캐시에 preview 에러 title이 있으면 enrich 후 `schedule-items`를 갱신합니다. */
export async function ensureSchedulePlanPlacesEnriched(
  queryClient: QueryClient,
  roomId: string,
  scheduleId: number,
): Promise<PlanPlace[]> {
  const rid = roomId.trim();
  if (!rid.length) return [];
  const key = scheduleItemsQueryKey(rid, scheduleId);
  // 일정 불러오기가 진행 중이면 그 결과를 쓴다 — 방금 batch로 받은 장소를 일차마다 다시 받지 않는다
  const waitedForHydration = await waitForRoomSchedulesHydration(queryClient, rid);
  const cached = queryClient.getQueryData<PlanPlace[]>(key);
  if (cached != null && (waitedForHydration || !planPlacesNeedPreviewEnrich(cached))) {
    return cached;
  }
  if (cached != null) {
    // 지금 일차 목록(삭제·수정·순서가 반영됨)은 그대로 두고 자리표시자 장소의 미리보기만 채운다 —
    // room-schedules의 items는 장소 단위 변경을 따라가지 않아, 거기서 다시 만들면 지운 장소가 되살아난다
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
  const key = scheduleItemsQueryKey(roomId, scheduleId);
  const state = queryClient.getQueryState<PlanPlace[]>(key);
  // 미리보기 오류의 재진입 복구만 캐시 목록을 유지한다. 변경 알림의 무효화는 HTTP로 확인한다.
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
    refetchOnMount: (query) => {
      const data = query.state.data;
      return data && planPlacesNeedPreviewEnrich(data) ? "always" : true;
    },
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

/** 순서 응답을 반영합니다. 경로 캐시는 출발·도착 항목 키로 구분합니다. */
export async function syncPlanPlacesAfterReorderSuccess(
  queryClient: QueryClient,
  roomId: string,
  scheduleId: number,
  items: RoomScheduleItem[],
): Promise<void> {
  const rid = roomId.trim();
  if (!rid.length) return;

  await mergeOrRefetchSchedulePlanPlacesFromItems(
    queryClient,
    roomId,
    scheduleId,
    items,
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

/** 놓은 자리(`insertIndex`)를 서버 `orderIndex`로 바꿔 장소를 추가합니다. 서버가 이동수단 추천까지 처리하고 델타를 돌려줍니다. */
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

/** 장소 추가 응답(추가된 항목·순서가 밀린 항목)을 일차 목록에 합칩니다. */
export async function applyCreatedScheduleItemToPlanPlaces(
  queryClient: QueryClient,
  roomId: string,
  scheduleId: number,
  response: CreateScheduleItemResponse,
): Promise<void> {
  // 미리보기를 못 받으면 자리표시자 장소로 합친다(planPlaceFromScheduleItem은 던지지 않음)
  const createdPlace = await planPlaceFromScheduleItem(response.createdItem);
  // 미리보기를 기다리는 사이 다른 사람의 변경을 받았을 수 있어 그 뒤의 목록에 합친다
  queryClient.setQueryData<PlanPlace[]>(
    scheduleItemsQueryKey(roomId.trim(), scheduleId),
    (old) => mergeCreatedScheduleItemDelta(old, createdPlace, response) ?? old,
  );
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
