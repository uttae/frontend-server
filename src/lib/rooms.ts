import type { QueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import type {
  RoomDetail,
  RoomListItem,
  RoomListResponse,
} from "@/lib/api/rooms";
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
import {
  ROOMS_QUERY_KEY,
  roomDetailQueryKey,
  roomSchedulesQueryKey,
  scheduleItemsQueryKey,
} from "@/lib/query-keys";

/** 일차 삭제 후 route·items 쿼리 캐시 제거 (삭제된 scheduleId에 대한 GET 방지) */
export function removeCachesForDeletedSchedule(
  queryClient: QueryClient,
  roomId: string,
  scheduleId: number,
): void {
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

/** 서버가 확인한 기존 방 참여자만 초대 링크 공유와 여행 정보 수정을 할 수 있다. */
export function isRoomMemberRole(role: string | undefined | null): boolean {
  return isHostRole(role) || role?.toUpperCase() === "MEMBER";
}

/** 방 목록·상세·멤버 role 중 하나라도 HOST 이면 true (캐시 타이밍 보강) */
export function resolveViewerIsHost(sources: {
  listRole?: string | null;
  detailRole?: string | null;
  memberRole?: string | null;
}): boolean {
  return (
    isHostRole(sources.listRole) ||
    isHostRole(sources.detailRole) ||
    isHostRole(sources.memberRole)
  );
}

/**
 * 입장 요청(join-requests) 등 호스트 전용 API와 맞춰 쓸 방 선택.
 * - `anyHostedRoom`: 현재 방이 호스트면 그 방, 아니면 목록에서 첫 호스트 방(배지·설정용).
 * - `currentRoomHostOnly`: 현재 선택 방에서만 호스트일 때만 해당 방(멤버로 보고 있을 때 불필요한 GET 방지).
 */
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

/**
 * `room-schedules`의 queryFn — `GET /rooms/{roomId}/schedules?includeItems=true`로 일차 목록과
 * 일차별 장소(`schedule-items`) 캐시를 함께 채웁니다. 직접 부르지 말고 조회(`useRoomSchedules`·
 * `refreshRoomSchedules`)를 거쳐야 진행 중인 옛 조회가 취소됩니다.
 * 신규 일차만 항목 캐시를 `[]`로 시딩하고, 기존 scheduleId의 항목 캐시는 보존합니다.
 */
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
  const placesBySchedule = await buildSchedulePlacesFromSchedulesWithItems(
    queryClient,
    sorted,
  );
  // 더 늦게 시작한 조회가 이 조회를 취소했으면 이 응답은 옛 스냅샷이다 — 캐시를 덮지 않는다
  if (signal?.aborted) return sorted;

  // 미리보기를 기다리는 동안 들어온 변경을 덮지 않도록 캐시는 여기서 한 번에 쓴다
  const prevSchedules =
    queryClient.getQueryData<RoomScheduleWithItems[]>(
      roomSchedulesQueryKey(rid),
    ) ?? [];
  const prevIds = prevSchedules.map((s) => s.scheduleId);

  queryClient.setQueryData<RoomScheduleWithItems[]>(
    roomSchedulesQueryKey(rid),
    sorted,
  );

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

/** `useRoomSchedules`와 동일 경로로 일정·장소 preview hydrate가 끝날 때까지 대기합니다. */
export async function awaitRoomSchedulesHydrated(
  queryClient: QueryClient,
  roomId: string,
): Promise<RoomScheduleWithItems[]> {
  const rid = roomId.trim();
  if (!rid.length) return [];

  return queryClient.fetchQuery({
    queryKey: roomSchedulesQueryKey(rid),
    queryFn: ({ signal }) =>
      hydrateRoomSchedulesFromServer(queryClient, rid, signal),
    staleTime: Infinity,
  });
}

/**
 * 일정 전체를 다시 받습니다(본인의 일차 생성·삭제·이동, 여행 날짜 변경 직후).
 * 진행 중이던 조회는 이 변경 전 스냅샷이라 취소하고, `room-schedules` 조회 하나로 받아
 * 마지막에 시작한 조회만 캐시에 쓰게 합니다.
 */
export async function refreshRoomSchedules(
  queryClient: QueryClient,
  roomId: string,
): Promise<RoomScheduleWithItems[]> {
  const rid = roomId.trim();
  if (!rid.length) return [];

  const queryKey = roomSchedulesQueryKey(rid);
  await queryClient.cancelQueries({ queryKey, exact: true });
  return queryClient.fetchQuery({
    queryKey,
    queryFn: ({ signal }) =>
      hydrateRoomSchedulesFromServer(queryClient, rid, signal),
    staleTime: 0,
  });
}

/** `GET /rooms/{roomId}` 결과로 room-detail·방 목록 캐시를 맞춥니다. */
export async function syncRoomDetailFromServer(
  queryClient: QueryClient,
  roomId: string,
): Promise<void> {
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

/**
 * Persist된 `currentRoomId` 등이 서버에서 여전히 유효한지 확인합니다.
 * 네트워크 오류 등은 `"error"`로 두고 스토어는 건드리지 않습니다.
 */
const VALIDATE_ROOM_ACCESS_FORBIDDEN_RETRIES = 3;
const VALIDATE_ROOM_ACCESS_RETRY_BASE_MS = 400;

/** 승인 직후 `GET /rooms/:id` 일시 403 등과의 레이스를 줄이기 위해 forbidden 시 짧게 재시도합니다. */
export async function validateRoomAccess(
  roomId: string,
): Promise<RoomAccessVerdict> {
  const rid = roomId.trim();
  if (!rid.length) return "error";

  const delayAfterAttempt = async (attempt: number) => {
    if (attempt < VALIDATE_ROOM_ACCESS_FORBIDDEN_RETRIES - 1) {
      await new Promise((r) =>
        setTimeout(r, VALIDATE_ROOM_ACCESS_RETRY_BASE_MS * (attempt + 1)),
      );
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
