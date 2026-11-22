import { bucketItemCount } from "@/lib/analytics/context";
import { AnalyticsEvents, trackAnalyticsEvent } from "@/lib/analytics/track";
import { trackRoomMutation } from "@/lib/analytics/room-mutation";
import { beginExpenseRoomAdmission } from "@/lib/expenses/expense-recovery";
import { joinStatusForWaitingUi } from "@/lib/join-room-workflow";
import { invalidateExpenses, expenseKeys } from "@/lib/expenses/expense-queries";
import {
  queryOptions,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { usePathname } from "next/navigation";

import { useStompContext } from "@/contexts/StompContext";

import {
  approveJoinRequest,
  createBookmarkCategory,
  createRoomBookmarks,
  createRoom,
  createRoomSchedule,
  deleteScheduleItem,
  reorderScheduleItem,
  moveScheduleItemToSchedule,
  updateScheduleItem,
  updateScheduleItemTravelMode,
  deleteRoomBookmark,
  deleteBookmarkCategory,
  deleteRoom,
  deleteRoomSchedule,
  getBookmarkCategories,
  getJoinRequests,
  getJoinStatus,
  getAllRoomBookmarks,
  getRoomMembers,
  patchRoomBookmarkCategory,
  getRooms,
  joinRoom,
  kickMember,
  leaveRoom,
  moveRoomSchedule,
  regenerateInviteCode,
  rejectJoinRequest,
  type BookmarkCategory,
  type RoomBookmark,
  type RoomCreateRequest,
  type RoomScheduleCreateRequest,
  type RoomScheduleWithItems,
  type ReorderScheduleItemRequest,
  type RoomScheduleItemUpdateRequest,
  type RoomUpdateRequest,
  transferHost,
  updateBookmarkCategory,
  updateRoom,
  type RoomDetail,
  type RoomListItem,
  type RoomListResponse,
} from "@/lib/api/rooms";
import {
  applyCreatedScheduleItemToPlanPlaces,
  applyRoomScheduleItemToPlanPlaces,
  createScheduleItemAtPlanIndex,
  removeScheduleItemFromPlanPlacesCache,
  schedulePlanPlacesQueryOptions,
} from "@/lib/plan/scheduleItemPlaces";
import {
  insertPlanPlace,
  movePlanPlaceWithinDay,
  moveRoomScheduleToDay,
  removePlanPlace,
} from "@/lib/plan/planListMove";
import {
  appendBookmarkCategoryToCache,
  appendRoomBookmarksToCache,
} from "@/lib/bookmarks/bookmark-cache-patch";
import { invalidateRoomBookmarkLists } from "@/lib/bookmarks-invalidation";
import {
  bookmarkCategoriesQueryKey,
  joinRequestsQueryKey,
  roomAllBookmarksQueryKey,
  ROOMS_QUERY_KEY,
  roomDetailQueryKey,
  roomMembersQueryKey,
  roomSchedulesQueryKey,
  scheduleItemsQueryKey,
} from "@/lib/query-keys";
import {
  hydrateRoomSchedulesFromServer,
  refreshRoomSchedules,
  syncRoomDetailFromServer,
} from "@/lib/rooms";
import type { PlanPlace } from "@/lib/plan/types";
import {
  pathDefersRoomStompRoomTopics,
  pathSuspendsStomp,
} from "@/lib/stomp/stompPathPolicy";
import { persistedScheduleItemRouteQueryOptions } from "@/lib/plan/scheduleItemRoutePersistedQuery";
import type { ScheduleTravelModeValue } from "@/lib/plan/scheduleTravelMode";
import { useSessionUser } from "@/hooks/useSessionUser";
import { applyHostTransferToCache } from "@/lib/rooms/host-transfer-cache";
import { readSessionUserId } from "@/lib/session-user-cache";
import { evictRoomFromClientCaches } from "@/lib/stomp/forced-room-exit-dispatch";

export function useRoomsList() {
  return useQuery({
    queryKey: ROOMS_QUERY_KEY,
    queryFn: () => getRooms(),
  });
}

export function useCreateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RoomCreateRequest) => createRoom(data),
    onSuccess: async (room) => {
      const rid = room.id.trim();
      if (rid.length) {
        queryClient.setQueryData<RoomDetail>(roomDetailQueryKey(rid), {
          id: room.id,
          title: room.title,
          destinations: room.destinations,
          startDate: room.startDate,
          endDate: room.endDate,
          inviteCode: room.inviteCode,
          memberCount: room.memberCount,
          role: room.role,
          createdAt: room.createdAt,
        });
        const listItem: RoomListItem = {
          id: room.id,
          title: room.title,
          destinations: room.destinations,
          startDate: room.startDate,
          endDate: room.endDate,
          role: room.role,
          joinedAt: room.createdAt,
        };
        queryClient.setQueryData<RoomListResponse>(ROOMS_QUERY_KEY, (prev) => {
          if (!prev) {
            return {
              rooms: [listItem],
              nextCursor: null,
              hasNext: false,
            };
          }
          if (prev.rooms.some((r) => r.id === rid)) {
            return {
              ...prev,
              rooms: prev.rooms.map((r) =>
                r.id === rid ? { ...r, ...listItem } : r,
              ),
            };
          }
          return { ...prev, rooms: [listItem, ...prev.rooms] };
        });
      }
      queryClient.invalidateQueries({ queryKey: ROOMS_QUERY_KEY });
      await refreshRoomSchedules(queryClient, room.id);
      await syncRoomDetailFromServer(queryClient, room.id);
    },
  });
}

export function useRoomSchedules(roomId: string | null) {
  const id = roomId?.trim() ?? "";
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: roomSchedulesQueryKey(id || null),
    queryFn: ({ signal }) =>
      hydrateRoomSchedulesFromServer(queryClient, id, signal),
    enabled: id.length > 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useScheduleItemRoute(
  roomId: string | null,
  scheduleId: number | null,
  segmentSourceItemId: number | null,
  /** 다음 장소의 `itemId` */
  destinationItemId: number | null,
  travelMode: ScheduleTravelModeValue | null,
  /** 일정 장소 목록상 구간 소스 아이디가 존재·목록 안정 후에만 true */
  routeQueryEnabled = true,
  /** 빈 문자열이면 LS 미사용 — `scheduleFingerprint` 지문 필요 */
  scheduleFingerprint = "",
  /** 수단 저장 중에는 해당 구간의 캐시만 읽고 GET은 보류한다. */
  networkEnabled = routeQueryEnabled,
) {
  const rid = roomId?.trim() ?? "";

  return useQuery({
    ...persistedScheduleItemRouteQueryOptions(
      rid,
      scheduleId,
      segmentSourceItemId,
      destinationItemId,
      travelMode,
      scheduleFingerprint,
      { segmentReady: Boolean(routeQueryEnabled), networkEnabled },
    ),
  });
}

export function useDeleteRoomSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roomId,
      scheduleId,
    }: {
      roomId: string;
      scheduleId: number;
    }) => deleteRoomSchedule(roomId, scheduleId),
    onSuccess: async (_data, { roomId }) => {
      await invalidateExpenses(queryClient, roomId);
      const id = roomId.trim();
      if (!id.length) return;

      await refreshRoomSchedules(queryClient, id);
      await syncRoomDetailFromServer(queryClient, id);
    },
  });
}

/**
 * 일차(schedule) 생성 — 액터는 POST `onSuccess`, 원격은 STOMP `ROOM_SCHEDULES_RESYNCED`로 갱신합니다.
 */
export function useCreateRoomSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roomId,
      body,
    }: {
      roomId: string;
      body: RoomScheduleCreateRequest;
    }) => createRoomSchedule(roomId, body),
    onSuccess: async (_created, { roomId }) => {
      const id = roomId.trim();
      if (!id.length) return;
      await refreshRoomSchedules(queryClient, id);
      await syncRoomDetailFromServer(queryClient, id);
    },
  });
}

/**
 * 일차(schedule) 이동 — 일차 순서·날짜 라벨이 일정 전체에 보여 응답 전에 `room-schedules`를 새 순서로 고치고(onMutate),
 * 실패하면 되돌린다. 성공·실패 모두 마지막 저장이 끝날 때 일정을 다시 받는다 (원격: STOMP `ROOM_SCHEDULES_RESYNCED`)
 */
/** 일차 순서 변경 저장 — 마지막 저장이 끝날 때만 일정을 다시 받도록 진행 중인 저장을 이 key로 센다 */
const ROOM_SCHEDULE_MOVE_MUTATION_KEY = ["room-schedule-move"] as const;

export function useMoveRoomSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ROOM_SCHEDULE_MOVE_MUTATION_KEY,
    mutationFn: ({
      roomId,
      scheduleId,
      targetDayNumber,
    }: {
      roomId: string;
      scheduleId: number;
      targetDayNumber: number;
    }) => moveRoomSchedule(roomId, scheduleId, { targetDayNumber }),
    onMutate: async ({ roomId, scheduleId, targetDayNumber }) => {
      const key = roomSchedulesQueryKey(roomId.trim());
      // 진행 중인 일정 조회의 옛 순서가 먼저 고친 순서를 덮지 않게 취소한다
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      const previous = queryClient.getQueryData<RoomScheduleWithItems[]>(key);
      queryClient.setQueryData<RoomScheduleWithItems[]>(
        key,
        (old) => old && moveRoomScheduleToDay(old, scheduleId, targetDayNumber),
      );
      return { previous };
    },
    // 되돌린 값은 그사이 들어온 다른 사람의 변경을 지울 수 있다 — onSettled가 일정을 다시 받아 맞춘다
    onError: (_error, { roomId }, context) => {
      queryClient.setQueryData(roomSchedulesQueryKey(roomId.trim()), context?.previous);
    },
    onSuccess: async (_data, { roomId }) => {
      const id = roomId.trim();
      if (!id.length) return;
      await invalidateExpenses(queryClient, id);
    },
    // 연달아 옮기면 앞 저장이 끝날 때 다시 받은 일정이 뒤 저장 전 순서를 그린다 — 마지막 저장이 끝날 때 한 번만 받는다.
    // onSettled 안에서는 끝나는 저장도 아직 진행 중으로 세므로 1 이하면 남은 저장이 없다.
    // 다시 받기는 기다리지 않는다 — 기다리면 그 GET이 끝날 때까지 실패 토스트가 늦게 뜬다
    onSettled: (_data, _error, { roomId }) => {
      if (queryClient.isMutating({ mutationKey: ROOM_SCHEDULE_MOVE_MUTATION_KEY }) <= 1) {
        void queryClient.invalidateQueries({
          queryKey: roomSchedulesQueryKey(roomId.trim()),
          exact: true,
        });
      }
    },
  });
}

/**
 * 장소 순서 변경·일차 간 이동 저장 — 진행 중인 저장을 이 key로 찾는다.
 * 같은 일차의 마지막 저장이 끝날 때만 다시 받고(`isLastItemMoveOf`), 저장하는 동안 그 일차의 경로를 조회하지 않는다(`useScheduleItemMoveSavingDays`)
 */
const SCHEDULE_ITEM_MOVE_MUTATION_KEY = ["schedule-item-move"] as const;

/** 진행 중인 장소 이동 저장이 바꾸는 이 방의 일차 — mutation 캐시는 variables 타입을 모르므로 필드를 확인해 읽는다 */
function scheduleIdsOfItemMove(variables: unknown, roomId: string): number[] {
  if (typeof variables !== "object" || variables === null) return [];
  if (!("roomId" in variables) || typeof variables.roomId !== "string") return [];
  if (variables.roomId.trim() !== roomId) return [];
  const ids: unknown[] = [];
  if ("scheduleId" in variables) ids.push(variables.scheduleId);
  if ("sourceScheduleId" in variables) ids.push(variables.sourceScheduleId);
  if ("targetScheduleId" in variables) ids.push(variables.targetScheduleId);
  return ids.filter((id): id is number => typeof id === "number");
}

/**
 * 이 일차를 바꾸는 장소 이동 저장이 지금 끝나는 것 하나뿐인지. 연달아 놓았을 때 앞 저장이 끝날 때마다 다시 받으면
 * 뒤 저장 전의 서버 순서가 잠깐 그려진다 — 같은 일차의 마지막 저장이 끝날 때 한 번만 다시 받는다(TanStack 동시 낙관적 갱신).
 * onSettled 안에서는 끝나는 저장도 아직 진행 중으로 세므로 1 이하면 남은 저장이 없다
 */
function isLastItemMoveOf(
  queryClient: ReturnType<typeof useQueryClient>,
  roomId: string,
  scheduleId: number,
): boolean {
  const rid = roomId.trim();
  return (
    queryClient.isMutating({
      mutationKey: SCHEDULE_ITEM_MOVE_MUTATION_KEY,
      predicate: (mutation) =>
        scheduleIdsOfItemMove(mutation.state.variables, rid).includes(scheduleId),
    }) <= 1
  );
}

/**
 * 이 방에서 장소 이동을 저장하는 중인 일차. 캐시는 저장 응답 전에 새 순서지만 서버는 아직 옛 순서라,
 * 그 일차의 구간 경로를 지금 조회하면 옛 이웃까지의 경로가 새 구간 key에 저장된다 — 저장이 끝날 때까지 조회하지 않는다.
 * (여러 일차를 한 번에 그리는 지도를 위해 일차 목록으로 돌려준다)
 */
export function useScheduleItemMoveSavingDays(roomId: string): number[] {
  const rid = roomId.trim();
  return useMutationState({
    filters: { mutationKey: SCHEDULE_ITEM_MOVE_MUTATION_KEY, status: "pending" },
    select: (mutation) => scheduleIdsOfItemMove(mutation.state.variables, rid),
  }).flat();
}

/**
 * 일정 항목을 다른 일차로 이동 — 같은 일차 내 순서는 `useReorderScheduleItem` 사용.
 * 결과가 두 일차 목록과 지도에 함께 보여 응답 전에 두 일차 캐시를 먼저 고치고(onMutate), 실패하면 되돌린다.
 */
export function useMoveScheduleItemToSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: SCHEDULE_ITEM_MOVE_MUTATION_KEY,
    mutationFn: ({
      roomId,
      sourceScheduleId,
      itemId,
      targetScheduleId,
      targetOrderIndex,
    }: {
      roomId: string;
      sourceScheduleId: number;
      itemId: number;
      targetScheduleId: number;
      targetOrderIndex: number;
    }) => {
      if (sourceScheduleId === targetScheduleId) {
        throw new Error("같은 일차 안에서는 순서 변경만 가능해요.");
      }
      return moveScheduleItemToSchedule(roomId, sourceScheduleId, itemId, {
        targetScheduleId,
        targetOrderIndex,
      });
    },
    onMutate: async ({
      roomId,
      sourceScheduleId,
      itemId,
      targetScheduleId,
      targetOrderIndex,
    }) => {
      const rid = roomId.trim();
      const sourceKey = scheduleItemsQueryKey(rid, sourceScheduleId);
      const targetKey = scheduleItemsQueryKey(rid, targetScheduleId);
      // 진행 중인 조회의 옛 목록이 먼저 고친 목록을 덮지 않게 취소한다
      await Promise.all([
        queryClient.cancelQueries({ queryKey: sourceKey, exact: true }),
        queryClient.cancelQueries({ queryKey: targetKey, exact: true }),
      ]);
      const previousSource = queryClient.getQueryData<PlanPlace[]>(sourceKey);
      const previousTarget = queryClient.getQueryData<PlanPlace[]>(targetKey);
      // 옮길 장소는 출발 일차 캐시에서 꺼낸다
      const moved = previousSource?.find((p) => p.itemId === itemId);
      if (moved) {
        queryClient.setQueryData<PlanPlace[]>(
          sourceKey,
          (old) => old && removePlanPlace(old, itemId),
        );
        queryClient.setQueryData<PlanPlace[]>(
          targetKey,
          (old) => old && insertPlanPlace(old, moved, targetOrderIndex),
        );
      }
      return { previousSource, previousTarget };
    },
    // 되돌린 값은 그사이 들어온 다른 사람의 변경을 지울 수 있다 — onSettled가 두 일차를 다시 받아 맞춘다
    onError: (_error, { roomId, sourceScheduleId, targetScheduleId }, context) => {
      const rid = roomId.trim();
      queryClient.setQueryData(
        scheduleItemsQueryKey(rid, sourceScheduleId),
        context?.previousSource,
      );
      queryClient.setQueryData(
        scheduleItemsQueryKey(rid, targetScheduleId),
        context?.previousTarget,
      );
    },
    onSuccess: (_moved, { roomId }) => invalidateExpenses(queryClient, roomId),
    // 출발·대상 일차를 다시 받는다(성공·실패 모두). 그 일차를 바꾸는 저장이 더 남았으면 그 저장이 끝날 때 받는다.
    // `syncAfterCrossScheduleItemMove`는 출발 일차 재조회가 실패하면 throw해서, 여기서 쓰면 저장된 이동이 실패로 바뀌고
    // onError가 화면을 되돌린다
    // 다시 받기는 기다리지 않는다 — 기다리면 그 GET이 끝날 때까지 mutateAsync가 끝나지 않아 실패 토스트가 늦게 뜬다
    onSettled: (_moved, _error, { roomId, sourceScheduleId, targetScheduleId }) => {
      for (const scheduleId of [sourceScheduleId, targetScheduleId]) {
        if (isLastItemMoveOf(queryClient, roomId, scheduleId)) {
          void invalidateDayPlacesAfterOwnChange(queryClient, roomId, scheduleId);
        }
      }
    },
  });
}

export function useSchedulePlanPlaces(
  roomId: string | null,
  scheduleId: number | null,
) {
  const rid = roomId?.trim() ?? "";
  const sid = scheduleId;
  const queryClient = useQueryClient();
  const { isSuccess: schedulesHydrated } = useRoomSchedules(rid || null);

  return useQuery({
    ...schedulePlanPlacesQueryOptions(queryClient, rid, sid),
    enabled:
      rid.length > 0 &&
      typeof sid === "number" &&
      Number.isFinite(sid) &&
      schedulesHydrated,
    refetchOnWindowFocus: false,
  });
}

/**
 * 본인이 일정 장소를 바꾼 뒤(성공·실패 모두) 그 일차를 다시 받는다. 여러 사람이 함께 고치는 목록이라
 * 응답을 쓰는 사이 끝난 옛 조회나 다른 사람의 변경을 서버 기준으로 맞춘다. 진행 중인 옛 조회는 TanStack이 취소한다.
 */
function invalidateDayPlacesAfterOwnChange(
  queryClient: ReturnType<typeof useQueryClient>,
  roomId: string,
  scheduleId: number,
) {
  return queryClient.invalidateQueries({
    queryKey: scheduleItemsQueryKey(roomId.trim(), scheduleId),
    exact: true,
  });
}

export function useCreateScheduleItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      roomId: string;
      scheduleId: number;
      googlePlaceId: string;
      insertIndex?: number;
      placesSnapshot?: PlanPlace[];
    }) => {
      const places = vars.placesSnapshot ?? [];
      return createScheduleItemAtPlanIndex({
        roomId: vars.roomId,
        scheduleId: vars.scheduleId,
        places,
        insertIndex: vars.insertIndex ?? places.length,
        googlePlaceId: vars.googlePlaceId,
      });
    },
    onSuccess: (response, { roomId, scheduleId }) =>
      applyCreatedScheduleItemToPlanPlaces(
        queryClient,
        roomId,
        scheduleId,
        response,
      ),
    onSettled: (_response, _error, { roomId, scheduleId }) =>
      invalidateDayPlacesAfterOwnChange(queryClient, roomId, scheduleId),
  });
}

export function useUpdateScheduleItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      roomId: string;
      scheduleId: number;
      itemId: number;
      body: RoomScheduleItemUpdateRequest;
    }) =>
      updateScheduleItem(
        vars.roomId,
        vars.scheduleId,
        vars.itemId,
        vars.body,
      ),
    onSuccess: (updated, { roomId, scheduleId, body }) => {
      queryClient.setQueryData<PlanPlace[]>(
        scheduleItemsQueryKey(roomId.trim(), scheduleId),
        (old) =>
          applyRoomScheduleItemToPlanPlaces(old, updated, {
            memoTouched: Object.prototype.hasOwnProperty.call(body, "memo"),
          }) ?? old,
      );
    },
    onSettled: (_updated, _error, { roomId, scheduleId }) =>
      invalidateDayPlacesAfterOwnChange(queryClient, roomId, scheduleId),
  });
}

/**
 * 구간 공유 이동수단 변경 — 서버 DB 저장 후 `SCHEDULE_ITEM_TRAVEL_MODE_UPDATED`가
 * 브로드캐스트되며, 액터는 응답으로 `schedule-items` 캐시를 갱신합니다.
 * 수단별 경로 캐시는 모드 키로 분리돼 있어 무효화가 필요 없습니다.
 */
export function useUpdateScheduleItemTravelMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      roomId: string;
      scheduleId: number;
      itemId: number;
      travelMode: ScheduleTravelModeValue;
    }) =>
      updateScheduleItemTravelMode(
        vars.roomId,
        vars.scheduleId,
        vars.itemId,
        { travelMode: vars.travelMode },
      ),
    onSuccess: (updated, { roomId, scheduleId }) => {
      queryClient.setQueryData<PlanPlace[]>(
        scheduleItemsQueryKey(roomId.trim(), scheduleId),
        (old) => applyRoomScheduleItemToPlanPlaces(old, updated) ?? old,
      );
    },
    onSettled: (_updated, _error, { roomId, scheduleId }) =>
      invalidateDayPlacesAfterOwnChange(queryClient, roomId, scheduleId),
  });
}

export function useDeleteScheduleItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      roomId: string;
      scheduleId: number;
      itemId: number;
    }) => deleteScheduleItem(vars.roomId, vars.scheduleId, vars.itemId),
    onSuccess: async (_, { roomId, scheduleId, itemId }) => {
      await invalidateExpenses(queryClient, roomId);
      removeScheduleItemFromPlanPlacesCache(
        queryClient,
        roomId,
        scheduleId,
        itemId,
      );
    },
    onSettled: (_data, _error, { roomId, scheduleId }) =>
      invalidateDayPlacesAfterOwnChange(queryClient, roomId, scheduleId),
  });
}

/**
 * 순서 변경 — 결과가 일차 목록·지도에 함께 보여 응답 전에 그 일차 캐시를 새 순서로 고치고(onMutate), 실패하면 되돌린다.
 * 응답은 캐시에 쓰지 않는다 — 이미 새 순서로 그렸고, 연달아 놓으면 앞 응답이 뒤 저장 전 순서를 다시 그린다.
 * 서버 상태는 그 일차의 마지막 저장이 끝날 때 다시 받아 맞춘다(onSettled)
 */
export function useReorderScheduleItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: SCHEDULE_ITEM_MOVE_MUTATION_KEY,
    mutationFn: (vars: {
      roomId: string;
      scheduleId: number;
      itemId: number;
      body: ReorderScheduleItemRequest;
    }) =>
      reorderScheduleItem(
        vars.roomId,
        vars.scheduleId,
        vars.itemId,
        vars.body,
      ),
    onMutate: async ({ roomId, scheduleId, itemId, body }) => {
      const key = scheduleItemsQueryKey(roomId.trim(), scheduleId);
      // 진행 중인 조회의 옛 목록이 먼저 고친 목록을 덮지 않게 취소한다
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      const previous = queryClient.getQueryData<PlanPlace[]>(key);
      queryClient.setQueryData<PlanPlace[]>(
        key,
        (old) => old && movePlanPlaceWithinDay(old, itemId, body.newOrderIndex),
      );
      return { previous };
    },
    // 되돌린 값은 그사이 들어온 다른 사람의 변경을 지울 수 있다 — onSettled가 그 일차를 다시 받아 맞춘다
    onError: (_error, { roomId, scheduleId }, context) => {
      queryClient.setQueryData(
        scheduleItemsQueryKey(roomId.trim(), scheduleId),
        context?.previous,
      );
    },
    onSuccess: (items, { roomId }) => {
      // 서버가 확인한 순서 변경만 기록한다(낙관적 표시는 쓰기 이벤트가 아님). 순서 변경은 드래그로만 하고,
      // 응답은 그 일차 전체라 길이가 곧 일차의 장소 수다
      trackAnalyticsEvent(AnalyticsEvents.reorderItinerary, {
        room_id: roomId,
        item_count_bucket: bucketItemCount(items.length),
        method: "drag_drop",
      });
    },
    // 다시 받기는 기다리지 않는다 — 기다리면 그 GET이 끝날 때까지 mutateAsync가 끝나지 않아 실패 토스트가 늦게 뜬다
    onSettled: (_items, _error, { roomId, scheduleId }) => {
      if (isLastItemMoveOf(queryClient, roomId, scheduleId)) {
        void invalidateDayPlacesAfterOwnChange(queryClient, roomId, scheduleId);
      }
    },
  });
}

export function useUpdateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roomId,
      data,
    }: {
      roomId: string;
      data: RoomUpdateRequest;
      previousStartDate?: string | null;
      previousEndDate?: string | null;
    }) => trackRoomMutation(queryClient, roomId, AnalyticsEvents.roomInfoUpdated,
      () => updateRoom(roomId, data), result => result.role),
    retry: false,
    onSuccess: async (
      updated,
      { roomId, data, previousStartDate, previousEndDate },
    ) => {
      queryClient.setQueryData<RoomListResponse>(ROOMS_QUERY_KEY, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          rooms: prev.rooms.map((r) =>
            r.id === roomId ?
              {
                ...r,
                title: updated.title,
                destinations: updated.destinations,
                startDate: updated.startDate ?? null,
                endDate: updated.endDate ?? null,
              }
            : r,
          ),
        };
      });
      queryClient.setQueryData<RoomDetail>(
        roomDetailQueryKey(roomId),
        (prev) =>
          prev && prev.id === roomId ?
            {
              ...prev,
              title: updated.title,
              destinations: updated.destinations,
              startDate: updated.startDate ?? null,
              endDate: updated.endDate ?? null,
            }
          : prev,
      );

      const prevStart = previousStartDate?.trim() ?? "";
      const prevEnd = previousEndDate?.trim() ?? "";
      const datesChanged =
        (data.startDate !== undefined && data.startDate !== prevStart) ||
        (data.endDate !== undefined && data.endDate !== prevEnd);

      if (datesChanged) {
        await invalidateExpenses(queryClient, roomId);
        await refreshRoomSchedules(queryClient, roomId);
      }
    },
  });
}

export function useDeleteRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roomId: string) => deleteRoom(roomId),
    onSuccess: (_, roomId) => {
      queryClient.removeQueries({ queryKey: expenseKeys.room(roomId) });
      queryClient.invalidateQueries({ queryKey: ROOMS_QUERY_KEY });
    },
  });
}

export function useRegenerateInviteCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roomId, trigger }: { roomId: string; trigger: "explicit" | "automatic" }) =>
      trigger === "automatic" ? regenerateInviteCode(roomId) :
        trackRoomMutation(queryClient, roomId, AnalyticsEvents.inviteCodeIssued,
          () => regenerateInviteCode(roomId)),
    retry: false,
    onSuccess: (data, { roomId }) => {
      queryClient.setQueryData<RoomDetail>(
        roomDetailQueryKey(roomId),
        (prev) => (prev ? { ...prev, inviteCode: data.inviteCode } : prev),
      );
    },
  });
}

export function useRoomMembers(roomId: string | null) {
  const pathname = usePathname();
  const { data: user } = useSessionUser();
  const { connected: stompConnected } = useStompContext();

  /**
   * 방 토픽을 구독하는 구간에서는 STOMP 연결·`/app/ping` 이전에 GET /members 가 먼저 나가면
   * `isOnline` 이 모두 false 로 내려오는 경우가 있다. STOMP 연결 후에만 조회한다.
   * `/home` 등 방 토픽을 미루는 경로는 즉시 조회(ping은 연결 단위로 계속 전송).
   */
  const waitForStompBeforeMembers =
    Boolean(user && roomId) &&
    !pathSuspendsStomp(pathname) &&
    !pathDefersRoomStompRoomTopics(pathname);

  return useQuery({
    queryKey: roomMembersQueryKey(roomId),
    // 멤버 이벤트·접속 변화로 받는 중인 조회가 취소되면 그 HTTP 요청도 끊는다
    queryFn: ({ signal }) => getRoomMembers(roomId!, signal),
    enabled: !!roomId && (!waitForStompBeforeMembers || stompConnected),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useJoinRoom() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (inviteCode: string) => {
      const confirm = beginExpenseRoomAdmission(client);
      const response = await joinRoom(inviteCode);
      confirm(response.id, response.httpStatus === 200);
      return response;
    },
  });
}

export function useCheckJoinStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (roomId: string) => {
      const confirm = beginExpenseRoomAdmission(client);
      const response = await getJoinStatus(roomId);
      confirm(
        roomId,
        response.id === roomId && joinStatusForWaitingUi(response) === "APPROVED",
      );
      return response;
    },
  });
}

export function useJoinRequests(
  roomId: string | null,
  options?: { enabled?: boolean },
) {
  const userEnabled = options?.enabled ?? true;
  return useQuery({
    queryKey: joinRequestsQueryKey(roomId),
    queryFn: () => getJoinRequests(roomId!),
    enabled: !!roomId && userEnabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useTransferHost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roomId,
      targetUserId,
    }: {
      roomId: string;
      targetUserId: number;
    }) => transferHost(roomId, targetUserId),
    onSuccess: (_, { roomId, targetUserId }) => {
      applyHostTransferToCache(
        queryClient,
        roomId,
        readSessionUserId(queryClient),
        targetUserId,
      );
    },
    // 방장 판정의 세 출처를 서버 값으로 다시 맞춘다(실패해도) — 성공하면 캐시는 바로 바뀌어 있으므로 화면은 기다리지 않는다
    onSettled: (_data, _error, { roomId }) => {
      void queryClient.invalidateQueries({ queryKey: roomMembersQueryKey(roomId) });
      void queryClient.invalidateQueries({ queryKey: roomDetailQueryKey(roomId) });
      void queryClient.invalidateQueries({ queryKey: ROOMS_QUERY_KEY });
    },
  });
}

export function useLeaveRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roomId: string) => leaveRoom(roomId),
    // 나간 방은 접근 권한을 잃어 방 범위 조회가 403을 받는다 — 다시 받지 않고 바로 지운다(AGENTS.md: 권한 상실 시 즉시 제거).
    // 다른 탭은 STOMP 본인 MEMBER_LEFT(onSelfLeftRoom)가 같은 정리를 한다
    onSuccess: (_, roomId) => {
      evictRoomFromClientCaches(queryClient, roomId);
    },
    // 방 목록만 서버 기준으로 맞춘다. 나간 방은 위에서 이미 목록에서 뺐으므로 기다리지 않는다
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ROOMS_QUERY_KEY });
    },
  });
}

export function useKickMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, userId }: { roomId: string; userId: number }) =>
      kickMember(roomId, userId),
    // 응답 본문이 없어 목록에서 빠질 때까지 기다린다 — 확인창이 닫힌 뒤 내보낸 멤버가 잠깐 남지 않게
    onSettled: (_data, _error, { roomId }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: roomMembersQueryKey(roomId) }),
        queryClient.invalidateQueries({ queryKey: ROOMS_QUERY_KEY }),
      ]),
  });
}

export function useApproveJoinRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roomId,
      requestId,
    }: {
      roomId: string;
      requestId: number;
    }) => approveJoinRequest(roomId, requestId),
    // 응답 본문이 없어 요청 목록에서 빠지고 멤버 목록에 들어올 때까지 기다린다(같은 행을 다시 누르지 않게)
    onSettled: (_data, _error, { roomId }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: joinRequestsQueryKey(roomId) }),
        queryClient.invalidateQueries({ queryKey: roomMembersQueryKey(roomId) }),
        queryClient.invalidateQueries({ queryKey: ROOMS_QUERY_KEY }),
      ]),
  });
}

export function useRejectJoinRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roomId,
      requestId,
    }: {
      roomId: string;
      requestId: number;
    }) => rejectJoinRequest(roomId, requestId),
    // 응답 본문이 없어 요청 목록에서 빠질 때까지 기다린다(같은 행을 다시 누르지 않게)
    onSettled: (_data, _error, { roomId }) =>
      queryClient.invalidateQueries({ queryKey: joinRequestsQueryKey(roomId) }),
  });
}

export function useBookmarkCategories(
  roomId: string | null,
  options?: { enabled?: boolean },
) {
  const queryEnabled = options?.enabled ?? true;
  return useQuery({
    queryKey: bookmarkCategoriesQueryKey(roomId),
    queryFn: () => getBookmarkCategories(roomId!),
    enabled: !!roomId && queryEnabled,
    staleTime: Infinity,
    // Broadcasts/mutations invalidate folders; plain tab reentry reuses the cache.
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

export function useCreateBookmarkCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roomId,
      name,
      colorCode,
    }: {
      roomId: string;
      name: string;
      colorCode: string;
    }) => createBookmarkCategory(roomId, { name, colorCode }),
    onSuccess: (created, { roomId }) => {
      appendBookmarkCategoryToCache(queryClient, roomId, created);
    },
    // 응답을 이미 넣었으므로 기다리지 않는다(대화상자는 바로 닫힌다). 본인 STOMP 반향은 버려 바꾼 탭은 여기서 맞춘다
    onSettled: (_created, _error, { roomId }) => {
      void queryClient.invalidateQueries({
        queryKey: bookmarkCategoriesQueryKey(roomId),
      });
    },
  });
}

export function useUpdateBookmarkCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roomId,
      categoryId,
      name,
      colorCode,
    }: {
      roomId: string;
      categoryId: number;
      name: string;
      colorCode: string;
    }) => updateBookmarkCategory(roomId, categoryId, { name, colorCode }),
    // 수정 응답의 placeCount는 세지 않은 값(0)이라 이름·색만 반영한다
    onSuccess: (updated, { roomId, categoryId }) => {
      queryClient.setQueryData<BookmarkCategory[]>(
        bookmarkCategoriesQueryKey(roomId),
        (prev) =>
          prev?.map((c) =>
            c.categoryId === categoryId
              ? { ...c, name: updated.name, colorCode: updated.colorCode }
              : c,
          ),
      );
    },
    // 응답을 이미 반영했으므로 기다리지 않는다(대화상자는 바로 닫힌다)
    onSettled: (_updated, _error, { roomId }) => {
      void queryClient.invalidateQueries({
        queryKey: bookmarkCategoriesQueryKey(roomId),
      });
    },
  });
}

export function useDeleteBookmarkCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roomId,
      categoryId,
    }: {
      roomId: string;
      categoryId: number;
    }) => deleteBookmarkCategory(roomId, categoryId),
    // 서버가 폴더 안의 북마크도 함께 지운다. 본인 CATEGORY_DELETED는 STOMP에서 버리므로 여기서 둘 다 다시 받는다.
    // 응답 본문이 없어 목록에서 폴더가 빠질 때까지 기다린다 — 확인창이 닫힌 뒤 지운 폴더가 잠깐 남지 않게
    onSettled: (_data, _error, { roomId }) =>
      invalidateRoomBookmarkLists(queryClient, roomId),
  });
}

/**
 * 방 전체 북마크 조회 옵션. 카테고리별 목록도 이 캐시 하나에서 거른다 — 서버의 카테고리별 응답과 모양이 같고
 * 카테고리 안 순서(최근 추가 순)도 같아서, 폴더를 바꿀 때 GET·스켈레톤 없이 같은 사본을 쓴다.
 */
function roomBookmarksQueryOptions(roomId: string | null) {
  return queryOptions({
    queryKey: roomAllBookmarksQueryKey(roomId),
    queryFn: () => getAllRoomBookmarks(roomId!),
    // 본인 변경과 STOMP 무효화로만 갱신한다. 화면 밖에서 무효화된 목록은 다시 마운트될 때 받는다
    staleTime: Infinity,
  });
}

export function useAllRoomBookmarks(
  roomId: string | null,
  options?: { enabled?: boolean },
) {
  const queryEnabled = options?.enabled ?? true;
  return useQuery({
    ...roomBookmarksQueryOptions(roomId),
    enabled: !!roomId && queryEnabled,
  });
}

export function useRoomBookmarks(
  roomId: string | null,
  categoryId: number | null,
) {
  const idOk =
    categoryId != null && Number.isFinite(categoryId) && categoryId >= 0;
  return useQuery({
    // 카테고리를 고르기 전에는 전체 목록을 걸러 빈 목록을 내지 않고 '조회 전'으로 둔다(빈 상태 문구가 잠깐 보이지 않게)
    ...roomBookmarksQueryOptions(idOk ? roomId : null),
    enabled: !!roomId && idOk,
    select: (bookmarks) => bookmarks.filter((b) => b.categoryId === categoryId),
  });
}

/**
 * POST 한 번으로 `googlePlaceId` + `categoryIds` 배열 전달. 서버는 이미 이 장소가 있는 폴더를 건너뛰고
 * 새로 만든 북마크만 돌려줍니다(모두 있으면 빈 목록). 응답은 전체 목록·폴더 개수에 바로 넣고,
 * 끝나면 두 목록을 서버 기준으로 다시 받습니다. 409는 다른 요청이 같은 폴더에 동시에 넣은 경우라 실패로 둡니다.
 */
export function useCreateRoomBookmarksInCategories() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roomId,
      googlePlaceId,
      categoryIds,
    }: {
      roomId: string;
      googlePlaceId: string;
      categoryIds: number[];
    }) => createRoomBookmarks(roomId, { googlePlaceId, categoryIds }),
    onSuccess: (bookmarks, { roomId }) => {
      if (!bookmarks.length) return;
      const bumped = new Set(bookmarks.map((b) => b.categoryId));
      queryClient.setQueryData<BookmarkCategory[]>(
        bookmarkCategoriesQueryKey(roomId),
        (prev) => {
          if (!prev?.length) return prev;
          return prev.map((c) =>
            bumped.has(c.categoryId)
              ? { ...c, placeCount: c.placeCount + 1 }
              : c,
          );
        },
      );
      appendRoomBookmarksToCache(queryClient, roomId, bookmarks);
    },
    // 응답을 이미 반영했으므로 기다리지 않는다(대화상자는 바로 닫힌다). 409(동시 추가 충돌)·실패도 다른 탭·사람의 추가일 수 있어 다시 받는다
    onSettled: (_result, _error, { roomId }) => {
      void invalidateRoomBookmarkLists(queryClient, roomId);
    },
  });
}

export function useMoveRoomBookmark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roomId,
      bookmarkId,
      categoryId,
    }: {
      roomId: string;
      bookmarkId: number;
      categoryId: number;
      fromCategoryId: number;
    }) => patchRoomBookmarkCategory(roomId, bookmarkId, { categoryId }),
    // 옮긴 북마크로 바꿔 넣어 지금 폴더 목록에서 바로 빠지게 한다
    onSuccess: (moved, { roomId }) => {
      queryClient.setQueryData<RoomBookmark[]>(
        roomAllBookmarksQueryKey(roomId),
        (prev) =>
          prev?.map((b) => (b.bookmarkId === moved.bookmarkId ? moved : b)),
      );
    },
    // 응답을 이미 반영했으므로 기다리지 않는다(메뉴는 바로 닫힌다). 폴더별 장소 개수와 정렬은 다시 받아 맞춘다
    onSettled: (_moved, _error, { roomId }) => {
      void invalidateRoomBookmarkLists(queryClient, roomId);
    },
  });
}

export function useDeleteRoomBookmarkItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      roomId: string;
      bookmarkId: number;
      categoryId: number;
    }) => deleteRoomBookmark(input.roomId, input.bookmarkId),
    // 응답 본문이 없어 목록에서 빠질 때까지 기다린다 — 확인창이 닫힌 뒤 지운 장소가 잠깐 남지 않게
    onSettled: (_data, _error, { roomId }) =>
      invalidateRoomBookmarkLists(queryClient, roomId),
  });
}
