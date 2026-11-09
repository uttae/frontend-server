export type RoomScheduleEventType =
  | "ROOM_SCHEDULES_RESYNCED"
  | "SCHEDULE_ITEM_MOVED"
  | "SCHEDULE_ITEM_CREATED"
  | "SCHEDULE_ITEM_UPDATED"
  | "SCHEDULE_ITEM_DELETED"
  | "SCHEDULE_ITEMS_REORDERED"
  | "SCHEDULE_ITEM_TRAVEL_MODE_UPDATED";

/** `/topic/rooms/{roomId}/schedules` 브로드캐스트 본문 */
export type RoomScheduleChangedEvent = {
  roomId: string;
  actorUserId: number;
  type: RoomScheduleEventType;
  scheduleId: number | null;
  itemId: number | null;
  affectedRouteItemIds: number[] | null;
  scheduleIds: number[] | null;
  /** 변경 요청을 보낸 탭 ID — 같으면 이 탭의 반향(`isOwnEcho`) */
  originTabId?: string | null;
};

const KNOWN_TYPES = new Set<string>([
  "ROOM_SCHEDULES_RESYNCED",
  "SCHEDULE_ITEM_MOVED",
  "SCHEDULE_ITEM_CREATED",
  "SCHEDULE_ITEM_UPDATED",
  "SCHEDULE_ITEM_DELETED",
  "SCHEDULE_ITEMS_REORDERED",
  "SCHEDULE_ITEM_TRAVEL_MODE_UPDATED",
]);

const ITEM_EVENT_TYPES = new Set<string>([
  "SCHEDULE_ITEM_CREATED",
  "SCHEDULE_ITEM_UPDATED",
  "SCHEDULE_ITEM_DELETED",
  "SCHEDULE_ITEMS_REORDERED",
  "SCHEDULE_ITEM_TRAVEL_MODE_UPDATED",
]);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function parseRoomScheduleMessage(
  body: string,
): RoomScheduleChangedEvent | null {
  try {
    const raw = JSON.parse(body) as Partial<RoomScheduleChangedEvent>;
    const roomId = String(raw.roomId ?? "").trim();
    const type = raw.type;
    if (!roomId || typeof type !== "string" || !KNOWN_TYPES.has(type)) {
      return null;
    }

    if (type === "ROOM_SCHEDULES_RESYNCED") {
      return raw as RoomScheduleChangedEvent;
    }

    if (type === "SCHEDULE_ITEM_MOVED") {
      const scheduleIds = raw.scheduleIds;
      if (
        !Array.isArray(scheduleIds) ||
        scheduleIds.length < 2 ||
        !scheduleIds.every(isFiniteNumber)
      ) {
        return null;
      }
      return raw as RoomScheduleChangedEvent;
    }

    if (ITEM_EVENT_TYPES.has(type)) {
      if (!isFiniteNumber(raw.scheduleId) || !isFiniteNumber(raw.itemId)) {
        return null;
      }
      return raw as RoomScheduleChangedEvent;
    }

    return null;
  } catch {
    return null;
  }
}
