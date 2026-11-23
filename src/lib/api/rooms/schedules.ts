import { apiUrl, jsonBody, requestJson, requestVoid } from "@/lib/api/http";
import type { RoomScheduleItem } from "./schedule-items";

export type RoomSchedule = {
  scheduleId: number;
  roomId: string;
  dayNumber: number;
  date: string;
  createdAt: string;
};

export type RoomScheduleCreateRequest = {
  dayNumber?: number;
};

export type RoomScheduleMoveRequest = {
  targetDayNumber: number;
};

export async function createRoomSchedule(roomId: string, body: RoomScheduleCreateRequest): Promise<RoomSchedule> {
  return requestJson(
    apiUrl(`/rooms/${roomId}/schedules`),
    { method: "POST", ...jsonBody(body) },
    { errorMessage: "일정 생성 실패" },
  );
}

export type RoomScheduleWithItems = RoomSchedule & {
  items?: RoomScheduleItem[];
};

export type GetRoomSchedulesOptions = {
  includeItems?: boolean;
  signal?: AbortSignal;
};

export async function getRoomSchedules(
  roomId: string,
  options?: GetRoomSchedulesOptions,
): Promise<RoomScheduleWithItems[]> {
  const url = new URL(apiUrl(`/rooms/${roomId}/schedules`));
  if (options?.includeItems) {
    url.searchParams.set("includeItems", "true");
  }
  return requestJson(
    url.toString(),
    { signal: options?.signal },
    {
      errorMessage: "일정 목록 조회 실패",
    },
  );
}

export async function deleteRoomSchedule(roomId: string, scheduleId: number): Promise<void> {
  return requestVoid(
    apiUrl(`/rooms/${roomId}/schedules/${scheduleId}`),
    { method: "DELETE" },
    { errorMessage: "일정 삭제 실패" },
  );
}

export async function moveRoomSchedule(
  roomId: string,
  scheduleId: number,
  body: RoomScheduleMoveRequest,
): Promise<void> {
  return requestVoid(
    apiUrl(`/rooms/${roomId}/schedules/${scheduleId}/move`),
    { method: "PATCH", ...jsonBody(body) },
    { errorMessage: "일정 이동 실패" },
  );
}
