import { isCancelledError, type QueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import type { RoomDetail, RoomListItem, RoomListResponse } from "@/lib/api/rooms";
import { getRoomDetail, getRoomSchedules } from "@/lib/api/rooms";
import type { RoomScheduleWithItems } from "@/lib/api/rooms/schedules";
import { apiUrl } from "@/lib/api/http";
import { clearPersistedScheduleRoutesForSchedule } from "@/lib/plan/planTravelLocalStorage";
import {
  buildSchedulePlacesFromSchedulesWithItems,
  writeSchedulePlacesFromHydrate,
} from "@/lib/plan/schedule-bulk-hydration";
import { sortRoomSchedules } from "@/lib/plan/scheduleMerge";
import type { PlanPlace } from "@/lib/plan/types";
import { ROOMS_QUERY_KEY, roomDetailQueryKey, roomSchedulesQueryKey, scheduleItemsQueryKey } from "@/lib/query-keys";

export function removeCachesForDeletedSchedule(queryClient: QueryClient, roomId: string, scheduleId: number): void {
  const rid = roomId.trim();
  if (!rid.length) return;

  clearPersistedScheduleRoutesForSchedule(rid, scheduleId);

  queryClient.removeQueries({
    predicate: (q) => {
      const key = q.queryKey;
      if (!Array.isArray(key) || key[0] !== "schedule-item-route") {
        return false;
      }
      if (String(key[1] ?? "").trim() !== rid) return false;
      return key[2] === scheduleId;
    },
  });
  queryClient.removeQueries({
    queryKey: scheduleItemsQueryKey(rid, scheduleId),
  });
}

export type SelectHostRoomStrategy = "anyHostedRoom" | "currentRoomHostOnly";

export function isHostRole(role: string | undefined | null): boolean {
  if (typeof role !== "string") return false;
  return role.toUpperCase() === "HOST";
}

export function isRoomMemberRole(role: string | undefined | null): boolean {
  return isHostRole(role) || role?.toUpperCase() === "MEMBER";
}

export function resolveViewerIsHost(sources: {
  listRole?: string | null;
  detailRole?: string | null;
  memberRole?: string | null;
}): boolean {
  return isHostRole(sources.listRole) || isHostRole(sources.detailRole) || isHostRole(sources.memberRole);
}

export function selectHostRoom(
  rooms: RoomListItem[] | undefined,
  currentRoomId: string | null | undefined,
  strategy: SelectHostRoomStrategy,
): RoomListItem | undefined {
  if (!rooms?.length) return undefined;

  const inCurrent =
    currentRoomId != null && String(currentRoomId).trim() !== ""
      ? rooms.find((r) => r.id === currentRoomId && isHostRole(r.role))
      : undefined;

  if (strategy === "currentRoomHostOnly") {
    return inCurrent;
  }

  return inCurrent ?? rooms.find((r) => isHostRole(r.role));
}

export async function hydrateRoomSchedulesFromServer(
  queryClient: QueryClient,
  roomId: string,
  signal?: AbortSignal,
): Promise<RoomScheduleWithItems[]> {
  const rid = roomId.trim();
  if (!rid.length) return [];

  const startedAt = Date.now();
  const schedules = await getRoomSchedules(rid, { includeItems: true, signal });
  const sorted = sortRoomSchedules(schedules);
  const placesBySchedule = await buildSchedulePlacesFromSchedulesWithItems(queryClient, sorted);
  if (signal?.aborted) return sorted;

  const prevSchedules = queryClient.getQueryData<RoomScheduleWithItems[]>(roomSchedulesQueryKey(rid)) ?? [];
  const prevIds = prevSchedules.map((s) => s.scheduleId);

  queryClient.setQueryData<RoomScheduleWithItems[]>(roomSchedulesQueryKey(rid), sorted);

  const nextIds = new Set(sorted.map((s) => s.scheduleId));
  for (const prevId of prevIds) {
    if (!nextIds.has(prevId)) {
      removeCachesForDeletedSchedule(queryClient, rid, prevId);
    }
  }

  writeSchedulePlacesFromHydrate(queryClient, rid, placesBySchedule, startedAt);

  for (const s of sorted) {
    const key = scheduleItemsQueryKey(rid, s.scheduleId);
    if (queryClient.getQueryData<PlanPlace[]>(key) === undefined) {
      queryClient.setQueryData<PlanPlace[]>(key, []);
    }
  }

  return sorted;
}

export async function awaitRoomSchedulesHydrated(
  queryClient: QueryClient,
  roomId: string,
): Promise<RoomScheduleWithItems[]> {
  const rid = roomId.trim();
  if (!rid.length) return [];

  return queryClient.fetchQuery({
    queryKey: roomSchedulesQueryKey(rid),
    queryFn: ({ signal }) => hydrateRoomSchedulesFromServer(queryClient, rid, signal),
    staleTime: Infinity,
  });
}

export async function waitForRoomSchedulesHydration(queryClient: QueryClient, roomId: string): Promise<boolean> {
  const rid = roomId.trim();
  const queryKey = roomSchedulesQueryKey(rid);
  if (!rid.length || queryClient.isFetching({ queryKey, exact: true }) === 0) {
    return false;
  }

  while (queryClient.isFetching({ queryKey, exact: true }) > 0) {
    try {
      await queryClient.fetchQuery({
        queryKey,
        queryFn: ({ signal }) => hydrateRoomSchedulesFromServer(queryClient, rid, signal),
        staleTime: 0,
      });
      return true;
    } catch (error) {
      if (!isCancelledError(error)) throw error;
    }
  }
  return true;
}

export async function refreshRoomSchedules(queryClient: QueryClient, roomId: string): Promise<RoomScheduleWithItems[]> {
  const rid = roomId.trim();
  if (!rid.length) return [];

  const queryKey = roomSchedulesQueryKey(rid);
  await queryClient.cancelQueries({ queryKey, exact: true });
  return queryClient.fetchQuery({
    queryKey,
    queryFn: ({ signal }) => hydrateRoomSchedulesFromServer(queryClient, rid, signal),
    staleTime: 0,
  });
}

export async function syncRoomDetailFromServer(queryClient: QueryClient, roomId: string): Promise<void> {
  const rid = roomId.trim();
  if (!rid.length) return;
  let detail: RoomDetail;
  try {
    detail = await getRoomDetail(rid);
  } catch {
    return;
  }
  queryClient.setQueryData<RoomDetail>(roomDetailQueryKey(rid), detail);
  queryClient.setQueryData<RoomListResponse>(ROOMS_QUERY_KEY, (prev) => {
    if (!prev) return prev;
    return {
      ...prev,
      rooms: prev.rooms.map((r) =>
        r.id === rid
          ? {
              ...r,
              title: detail.title,
              destinations: detail.destinations,
              startDate: detail.startDate,
              endDate: detail.endDate,
            }
          : r,
      ),
    };
  });
}

export type RoomAccessVerdict = "ok" | "forbidden" | "error";

const VALIDATE_ROOM_ACCESS_FORBIDDEN_RETRIES = 3;
const VALIDATE_ROOM_ACCESS_RETRY_BASE_MS = 400;

export async function validateRoomAccess(roomId: string): Promise<RoomAccessVerdict> {
  const rid = roomId.trim();
  if (!rid.length) return "error";

  const delayAfterAttempt = async (attempt: number) => {
    if (attempt < VALIDATE_ROOM_ACCESS_FORBIDDEN_RETRIES - 1) {
      await new Promise((r) => setTimeout(r, VALIDATE_ROOM_ACCESS_RETRY_BASE_MS * (attempt + 1)));
    }
  };

  for (let attempt = 0; attempt < VALIDATE_ROOM_ACCESS_FORBIDDEN_RETRIES; attempt++) {
    try {
      const res = await apiFetch(apiUrl(`/rooms/${rid}`));
      if (res.ok) return "ok";
      if (res.status === 403 || res.status === 404) {
        if (attempt < VALIDATE_ROOM_ACCESS_FORBIDDEN_RETRIES - 1) {
          await delayAfterAttempt(attempt);
          continue;
        }
        return "forbidden";
      }
      return "error";
    } catch {
      await delayAfterAttempt(attempt);
    }
  }
  return "error";
}
