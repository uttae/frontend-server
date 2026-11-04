import { invalidateExpenses } from "@/lib/expenses/expense-queries";
import type { QueryClient } from "@tanstack/react-query";

import {
  invalidateSchedulePlanPlaces,
  syncAfterCrossScheduleItemMove,
} from "@/lib/plan/scheduleItemPlaces";
import { roomSchedulesQueryKey } from "@/lib/query-keys";
import { syncRoomDetailFromServer } from "@/lib/rooms";
import type { RoomScheduleChangedEvent } from "@/lib/stomp/schedule-events";
import { readSessionUserId } from "@/lib/session-user-cache";

/** 연속 일정 항목 동기화(GET items)를 한 번으로 묶음 — `SCHEDULE_ITEM_UPDATED` 전용 */
const syncSchedulePlacesFromItemsDebouncers = new Map<
  string,
  ReturnType<typeof setTimeout>
>();
/** 모으는 동안 다른 사람의 변경이 하나라도 들어온 일차 */
const syncSchedulePlacesRemoteChangePending = new Set<string>();
const DEBOUNCE_ITEMS_GET_MS = 90;

function enqueueDebouncedHydratePlacesFromScheduleItemsApi(
  queryClient: QueryClient,
  rid: string,
  sid: number,
  ownEcho: boolean,
): void {
  const mapKey = `${rid}:${sid}`;
  if (!ownEcho) syncSchedulePlacesRemoteChangePending.add(mapKey);
  const pending = syncSchedulePlacesFromItemsDebouncers.get(mapKey);
  if (pending !== undefined) clearTimeout(pending);
  syncSchedulePlacesFromItemsDebouncers.set(
    mapKey,
    setTimeout(() => {
      syncSchedulePlacesFromItemsDebouncers.delete(mapKey);
      // 모은 이벤트가 모두 본인 반향이면, 본인 저장이 끝나며 보낸 조회가 이미 그 변경을 담고 있어 합류한다
      const joinInFlight = !syncSchedulePlacesRemoteChangePending.has(mapKey);
      syncSchedulePlacesRemoteChangePending.delete(mapKey);
      void (async () => {
        try {
          await invalidateSchedulePlanPlaces(queryClient, rid, sid, {
            joinInFlight,
          });
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
 * — `schedule-item-route`: 무효화하지 않는다 — key에 도착 항목·이동수단이 있어, 순서·수단이 바뀐 구간은
 *   새 목록을 그릴 때 새 key로 받고 되돌리면 받아 둔 값을 쓴다
 * — `SCHEDULE_ITEM_UPDATED`: 일정 목록만 동기화할 때 사용(본인 이벤트 포함)
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
      /** 본인 삭제는 mutation이 응답으로 캐시를 고치고 그 일차를 다시 받는다 */
      if (actorIsMe) {
        return;
      }

      await invalidateSchedulePlanPlaces(queryClient, rid, sid);
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
      /** 본인 추가는 mutation이 응답으로 캐시를 고치고 그 일차를 다시 받는다 */
      if (actorIsMe) {
        return;
      }

      await invalidateSchedulePlanPlaces(queryClient, rid, sid);
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
      /** 본인 순서 변경은 mutation이 응답으로 캐시를 고치고 그 일차를 다시 받는다 */
      if (actorIsMe) {
        return;
      }

      await invalidateSchedulePlanPlaces(queryClient, rid, sid);
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

      enqueueDebouncedHydratePlacesFromScheduleItemsApi(
        queryClient,
        rid,
        sid,
        false,
      );
      return;
    }
  }
}
