import { invalidateExpenses } from "@/lib/expenses/expense-queries";
import type { QueryClient } from "@tanstack/react-query";

import {
  invalidateSchedulePlanPlaces,
  syncAfterCrossScheduleItemMove,
} from "@/lib/plan/scheduleItemPlaces";
import { roomSchedulesQueryKey } from "@/lib/query-keys";
import { syncRoomDetailFromServer } from "@/lib/rooms";
import { isOwnEcho } from "@/lib/stomp/own-echo";
import type { RoomScheduleChangedEvent } from "@/lib/stomp/schedule-events";

/** 연속 일정 항목 동기화(GET items)를 한 번으로 묶음 — `SCHEDULE_ITEM_UPDATED` 전용 */
const syncSchedulePlacesFromItemsDebouncers = new Map<
  string,
  ReturnType<typeof setTimeout>
>();
const DEBOUNCE_ITEMS_GET_MS = 90;

function enqueueDebouncedHydratePlacesFromScheduleItemsApi(
  queryClient: QueryClient,
  rid: string,
  sid: number,
): void {
  const mapKey = `${rid}:${sid}`;
  const pending = syncSchedulePlacesFromItemsDebouncers.get(mapKey);
  if (pending !== undefined) clearTimeout(pending);
  syncSchedulePlacesFromItemsDebouncers.set(
    mapKey,
    setTimeout(() => {
      syncSchedulePlacesFromItemsDebouncers.delete(mapKey);
      void (async () => {
        try {
          await invalidateSchedulePlanPlaces(queryClient, rid, sid);
        } catch {
          //
        }
      })();
    }, DEBOUNCE_ITEMS_GET_MS),
  );
}

/**
 * Plan 화면 등이 쓰는 캐시만, 스키마의 `type`별로 갱신합니다.
 * — 이 탭이 보낸 변경의 반향(`isOwnEcho`)은 건너뛴다. 그 탭의 mutation이 캐시를 맞춘다.
 *   같은 계정의 다른 탭과 탭 ID가 없는 변경은 다른 사람의 변경처럼 받는다
 * — `ROOM_SCHEDULES_RESYNCED`: `room-schedules` 전체 재조회 + 방 상세 동기화
 * — `schedule-items`: 그 일차 장소 목록을 무효화해 다시 받는다(보는 화면이 없으면 그 화면에 들어갈 때)
 * — `schedule-item-route`: 무효화하지 않는다 — key에 도착 항목·이동수단이 있어, 순서·수단이 바뀐 구간은
 *   새 목록을 그릴 때 새 key로 받고 되돌리면 받아 둔 값을 쓴다
 * — `SCHEDULE_ITEM_UPDATED`·`SCHEDULE_ITEM_TRAVEL_MODE_UPDATED`: 연속 이벤트를 모아 그 일차를 한 번만 다시 받는다
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
  if (isOwnEcho(event)) return;

  switch (event.type) {
    case "ROOM_SCHEDULES_RESYNCED": {
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

      await invalidateSchedulePlanPlaces(queryClient, rid, sid);
      return;
    }

    case "SCHEDULE_ITEM_CREATED": {
      const sid = event.scheduleId;
      const itemId = event.itemId;
      if (sid == null || itemId == null) return;

      await invalidateSchedulePlanPlaces(queryClient, rid, sid);
      return;
    }

    case "SCHEDULE_ITEMS_REORDERED": {
      const sid = event.scheduleId;
      const itemId = event.itemId;
      if (sid == null || itemId == null) return;

      await invalidateSchedulePlanPlaces(queryClient, rid, sid);
      return;
    }

    case "SCHEDULE_ITEM_UPDATED": {
      const sid = event.scheduleId;
      const itemId = event.itemId;
      if (sid == null || itemId == null) return;

      enqueueDebouncedHydratePlacesFromScheduleItemsApi(queryClient, rid, sid);
      return;
    }

    case "SCHEDULE_ITEM_TRAVEL_MODE_UPDATED": {
      const sid = event.scheduleId;
      const itemId = event.itemId;
      if (sid == null || itemId == null) return;

      enqueueDebouncedHydratePlacesFromScheduleItemsApi(queryClient, rid, sid);
      return;
    }
  }
}
