import { invalidateExpenses } from "@/lib/expenses/expense-queries";
import type { QueryClient } from "@tanstack/react-query";

import {
  invalidateSchedulePlanPlaces,
  syncAfterCrossScheduleItemMove,
} from "@/lib/plan/scheduleItemPlaces";
import {
  invalidateScheduleItemRouteForSources,
  invalidateScheduleItemRouteForWholeSchedule,
  removeRouteQueriesForDeletedItemSource,
} from "@/lib/plan/scheduleStompRouteScope";
import { roomSchedulesQueryKey } from "@/lib/query-keys";
import { syncRoomDetailFromServer } from "@/lib/rooms";
import type { RoomScheduleChangedEvent } from "@/lib/stomp/schedule-events";
import { readSessionUserId } from "@/lib/session-user-cache";
import { usePlanMapDirectionsEpochStore } from "@/stores/plan-map-directions-epoch-store";

function bumpMapForRouteSources(
  roomId: string,
  scheduleId: number,
  sourceItemIds: number[],
): void {
  if (sourceItemIds.length === 0) return;
  usePlanMapDirectionsEpochStore.getState().bumpSegments(
    roomId,
    sourceItemIds.map((segmentSourceItemId) => ({
      scheduleId,
      segmentSourceItemId,
    })),
  );
}

type DebouncedRouteInvBucket =
  | { scope: "whole" }
  | { scope: "sources"; ids: Set<number> };

/** 리오더 시 같은 구간 무효화를 짧게 묶어 `/route` 이중 패치를 줄임 */
const scheduleRouteInvalidateDebounceTimers = new Map<
  string,
  ReturnType<typeof setTimeout>
>();
const scheduleRouteInvalidatePending = new Map<string, DebouncedRouteInvBucket>();
const DEBOUNCE_SCHEDULE_ROUTE_INVALIDATE_MS = 100;

function mergeRouteInvalidateBucket(
  prev: DebouncedRouteInvBucket | undefined,
  sourcesToAdd: number[],
  forceWholeSchedule: boolean,
): DebouncedRouteInvBucket {
  if (forceWholeSchedule || prev?.scope === "whole") {
    return { scope: "whole" };
  }
  const ids =
    prev?.scope === "sources" ? prev.ids : new Set<number>();
  for (const id of sourcesToAdd) {
    ids.add(id);
  }
  return { scope: "sources", ids };
}

function enqueueDebouncedInvalidateScheduleRoutes(
  queryClient: QueryClient,
  rid: string,
  sid: number,
  sourcesForInvalidation: number[],
  forceWholeSchedule: boolean,
): void {
  const mapKey = `${rid}:${sid}`;
  scheduleRouteInvalidatePending.set(
    mapKey,
    mergeRouteInvalidateBucket(
      scheduleRouteInvalidatePending.get(mapKey),
      sourcesForInvalidation,
      forceWholeSchedule,
    ),
  );
  const existing = scheduleRouteInvalidateDebounceTimers.get(mapKey);
  if (existing !== undefined) clearTimeout(existing);

  scheduleRouteInvalidateDebounceTimers.set(
    mapKey,
    setTimeout(() => {
      scheduleRouteInvalidateDebounceTimers.delete(mapKey);
      const epochStore = usePlanMapDirectionsEpochStore.getState();
      const bucket = scheduleRouteInvalidatePending.get(mapKey);
      scheduleRouteInvalidatePending.delete(mapKey);
      if (!bucket) return;
      void (async () => {
        if (bucket.scope === "whole") {
          await invalidateScheduleItemRouteForWholeSchedule(
            queryClient,
            rid,
            sid,
          );
          epochStore.bumpForDirections(rid);
        } else if (bucket.ids.size > 0) {
          const sources = [...bucket.ids];
          await invalidateScheduleItemRouteForSources(
            queryClient,
            rid,
            sid,
            sources,
          );
          bumpMapForRouteSources(rid, sid, sources);
        }
      })();
    }, DEBOUNCE_SCHEDULE_ROUTE_INVALIDATE_MS),
  );
}

/** 연속 일정 항목 동기화(GET items)를 한 번으로 묶음 — `SCHEDULE_ITEM_UPDATED` 전용 */
const syncSchedulePlacesFromItemsDebouncers = new Map<
  string,
  ReturnType<typeof setTimeout>
>();
const syncSchedulePlacesRouteInvalidationPending = new Map<
  string,
  DebouncedRouteInvBucket
>();
/** 모으는 동안 다른 사람의 변경이 하나라도 들어온 일차 */
const syncSchedulePlacesRemoteChangePending = new Set<string>();
const DEBOUNCE_ITEMS_GET_MS = 90;

function enqueueDebouncedHydratePlacesFromScheduleItemsApi(
  queryClient: QueryClient,
  rid: string,
  sid: number,
  ownEcho: boolean,
  affectedRouteItemIds?: number[] | null,
): void {
  const mapKey = `${rid}:${sid}`;
  if (!ownEcho) syncSchedulePlacesRemoteChangePending.add(mapKey);
  if (affectedRouteItemIds !== undefined) {
    syncSchedulePlacesRouteInvalidationPending.set(
      mapKey,
      mergeRouteInvalidateBucket(
        syncSchedulePlacesRouteInvalidationPending.get(mapKey),
        affectedRouteItemIds ?? [],
        affectedRouteItemIds === null,
      ),
    );
  }
  const pending = syncSchedulePlacesFromItemsDebouncers.get(mapKey);
  if (pending !== undefined) clearTimeout(pending);
  syncSchedulePlacesFromItemsDebouncers.set(
    mapKey,
    setTimeout(() => {
      syncSchedulePlacesFromItemsDebouncers.delete(mapKey);
      const routeBucket =
        syncSchedulePlacesRouteInvalidationPending.get(mapKey);
      syncSchedulePlacesRouteInvalidationPending.delete(mapKey);
      // 모은 이벤트가 모두 본인 반향이면, 본인 저장이 끝나며 보낸 조회가 이미 그 변경을 담고 있어 합류한다
      const joinInFlight = !syncSchedulePlacesRemoteChangePending.has(mapKey);
      syncSchedulePlacesRemoteChangePending.delete(mapKey);
      void (async () => {
        try {
          await invalidateSchedulePlanPlaces(queryClient, rid, sid, {
            joinInFlight,
          });
          if (routeBucket?.scope === "whole") {
            await invalidateScheduleItemRouteForWholeSchedule(
              queryClient,
              rid,
              sid,
            );
            usePlanMapDirectionsEpochStore
              .getState()
              .bumpForDirections(rid);
          } else if (routeBucket && routeBucket.ids.size > 0) {
            const sources = [...routeBucket.ids];
            await invalidateScheduleItemRouteForSources(
              queryClient,
              rid,
              sid,
              sources,
            );
            bumpMapForRouteSources(rid, sid, sources);
          }
        } catch {
          //
        }
      })();
    }, DEBOUNCE_ITEMS_GET_MS),
  );
}

/**
 * Plan 화면 등이 쓰는 캐시만, 스키마의 `type`별로 갱신합니다.
 * — `ROOM_SCHEDULES_RESYNCED`: `room-schedules` 전체 재조회 + 방 상세 동기화 (원격 탭; 액터는 mutation `onSuccess`)
 * — `schedule-items`: 그 일차 장소 목록을 무효화해 다시 받는다(보는 화면이 없으면 그 화면에 들어갈 때)
 * — `schedule-item-route`: `itemId`·인접 구간의 `segmentSourceItemId`만 무효화(폴백 시 일정 전체)
 * — `SCHEDULE_ITEM_UPDATED`: 일정 목록만 동기화할 때 사용(본인 이벤트 포함); 경로(`schedule-item-route`)는 무효화하지 않음
 * — `SCHEDULE_ITEM_TRAVEL_MODE_UPDATED`: 공유 이동수단 변경 — 일정 목록만 동기화(경로 캐시는 수단별 키로 유지)
 * — 맵 polyline: 구간별 에폭(`bumpSegments`); 폴백 시 방 단위(`bumpForDirections`)
 */
export async function dispatchRoomScheduleEvent(
  queryClient: QueryClient,
  event: RoomScheduleChangedEvent,
): Promise<void> {
  const rid = String(event.roomId ?? "").trim();
  if (!rid) return;
  if (
    ["ROOM_SCHEDULES_RESYNCED", "SCHEDULE_ITEM_MOVED", "SCHEDULE_ITEM_DELETED"].includes(
      event.type,
    )
  ) {
    await invalidateExpenses(queryClient, rid);
  }
  const epochStore = usePlanMapDirectionsEpochStore.getState();

  switch (event.type) {
    case "ROOM_SCHEDULES_RESYNCED": {
      const me = readSessionUserId(queryClient);
      const actorIsMe =
        typeof me === "number" &&
        Number.isFinite(me) &&
        me === event.actorUserId;
      /** 본인 mutation은 `onSuccess`에서 schedules·room-detail 캐시 갱신 */
      if (actorIsMe) {
        return;
      }

      // 일정 전체 재조회는 room-schedules 조회 하나로 한다 — 진행 중인 옛 조회가 취소돼 새 일정을 덮지 않는다
      await queryClient.invalidateQueries({ queryKey: roomSchedulesQueryKey(rid) });
      await syncRoomDetailFromServer(queryClient, rid);
      return;
    }

    case "SCHEDULE_ITEM_MOVED": {
      const scheduleIds = event.scheduleIds;
      if (!scheduleIds || scheduleIds.length < 2) return;

      const sourceScheduleId = scheduleIds[0]!;
      const targetScheduleId = scheduleIds[1]!;
      const itemId = event.itemId;

      const me = readSessionUserId(queryClient);
      const actorIsMe =
        typeof me === "number" &&
        Number.isFinite(me) &&
        me === event.actorUserId;
      if (actorIsMe) {
        return;
      }

      await syncAfterCrossScheduleItemMove(
        queryClient,
        rid,
        sourceScheduleId,
        targetScheduleId,
        itemId ?? undefined,
        event.affectedRouteItemIds,
      );
      return;
    }

    case "SCHEDULE_ITEM_DELETED": {
      const sid = event.scheduleId;
      const itemId = event.itemId;
      if (sid == null || itemId == null) return;

      const me = readSessionUserId(queryClient);
      const actorIsMe =
        typeof me === "number" &&
        Number.isFinite(me) &&
        me === event.actorUserId;
      /** 본인 mutation은 `applyScheduleItemDeletedOnClient`에서 캐시·route 처리 */
      if (actorIsMe) {
        return;
      }

      removeRouteQueriesForDeletedItemSource(queryClient, rid, sid, itemId);

      await invalidateSchedulePlanPlaces(queryClient, rid, sid);

      const sources = event.affectedRouteItemIds;
      if (sources === null) {
        await invalidateScheduleItemRouteForWholeSchedule(queryClient, rid, sid);
        epochStore.bumpForDirections(rid);
      } else {
        await invalidateScheduleItemRouteForSources(queryClient, rid, sid, sources);
        bumpMapForRouteSources(rid, sid, sources);
      }
      return;
    }

    case "SCHEDULE_ITEM_CREATED": {
      const sid = event.scheduleId;
      const itemId = event.itemId;
      if (sid == null || itemId == null) return;

      const me = readSessionUserId(queryClient);
      const actorIsMe =
        typeof me === "number" &&
        Number.isFinite(me) &&
        me === event.actorUserId;
      /** 본인 mutation은 append/reorder 직후 구간 단위 무효화 — STOMP 선도착 시 일정 전체 `/route` 폭주 방지 */
      if (actorIsMe) {
        return;
      }

      await invalidateSchedulePlanPlaces(queryClient, rid, sid);

      const sources = event.affectedRouteItemIds;
      if (sources === null) {
        await invalidateScheduleItemRouteForWholeSchedule(queryClient, rid, sid);
        epochStore.bumpForDirections(rid);
      } else {
        await invalidateScheduleItemRouteForSources(queryClient, rid, sid, sources);
        bumpMapForRouteSources(rid, sid, sources);
      }
      return;
    }

    case "SCHEDULE_ITEMS_REORDERED": {
      const sid = event.scheduleId;
      const itemId = event.itemId;
      if (sid == null || itemId == null) return;

      const me = readSessionUserId(queryClient);
      const actorIsMe =
        typeof me === "number" &&
        Number.isFinite(me) &&
        me === event.actorUserId;
      /** 본인 mutation은 `syncPlanPlacesAfterReorderSuccess` 직후 구간 무효화 */
      if (actorIsMe) {
        return;
      }

      await invalidateSchedulePlanPlaces(queryClient, rid, sid);
      const sources = event.affectedRouteItemIds;
      enqueueDebouncedInvalidateScheduleRoutes(
        queryClient,
        rid,
        sid,
        sources ?? [],
        sources === null,
      );
      return;
    }

    case "SCHEDULE_ITEM_UPDATED": {
      const sid = event.scheduleId;
      const itemId = event.itemId;
      if (sid == null || itemId == null) return;

      const me = readSessionUserId(queryClient);
      const actorIsMe =
        typeof me === "number" &&
        Number.isFinite(me) &&
        event.actorUserId === me;
      // 같은 사용자의 다른 탭도 이 이벤트를 받으므로 HTTP 응답과 무관하게 목록을 동기화합니다.
      enqueueDebouncedHydratePlacesFromScheduleItemsApi(
        queryClient,
        rid,
        sid,
        actorIsMe,
      );
      return;
    }

    case "SCHEDULE_ITEM_TRAVEL_MODE_UPDATED": {
      const sid = event.scheduleId;
      const itemId = event.itemId;
      if (sid == null || itemId == null) return;

      const me = readSessionUserId(queryClient);
      const actorIsMe =
        typeof me === "number" &&
        Number.isFinite(me) &&
        event.actorUserId === me;
      /** 본인 PATCH는 mutation `onSuccess`에서 `schedule-items` 캐시 갱신 */
      if (actorIsMe) {
        return;
      }

      /** 항목 재조회 후 서버가 지정한 출발 항목의 경로만 갱신합니다. */
      enqueueDebouncedHydratePlacesFromScheduleItemsApi(
        queryClient,
        rid,
        sid,
        false,
        event.affectedRouteItemIds,
      );
      return;
    }
  }
}
