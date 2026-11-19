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
        } catch {}
      })();
    }, DEBOUNCE_ITEMS_GET_MS),
  );
}

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
  if (isOwnEcho(queryClient, event)) return;

  switch (event.type) {
    case "ROOM_SCHEDULES_RESYNCED": {
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
