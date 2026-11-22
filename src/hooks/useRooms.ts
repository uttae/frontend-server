import { bucketItemCount } from "@/lib/analytics/context";
import { AnalyticsEvents, trackAnalyticsEvent } from "@/lib/analytics/track";
import { trackRoomMutation } from "@/lib/analytics/room-mutation";
import { beginExpenseRoomAdmission } from "@/lib/expenses/expense-recovery";
import { joinStatusForWaitingUi } from "@/lib/join-room-workflow";
import { invalidateExpenses, expenseKeys } from "@/lib/expenses/expense-queries";
import { queryOptions, useMutation, useMutationState, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { appendBookmarkCategoryToCache, appendRoomBookmarksToCache } from "@/lib/bookmarks/bookmark-cache-patch";
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
import { hydrateRoomSchedulesFromServer, refreshRoomSchedules, syncRoomDetailFromServer } from "@/lib/rooms";
import type { PlanPlace } from "@/lib/plan/types";
import { pathDefersRoomStompRoomTopics, pathSuspendsStomp } from "@/lib/stomp/stompPathPolicy";
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
              rooms: prev.rooms.map((r) => (r.id === rid ? { ...r, ...listItem } : r)),
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
    queryFn: ({ signal }) => hydrateRoomSchedulesFromServer(queryClient, id, signal),
    enabled: id.length > 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useScheduleItemRoute(
  roomId: string | null,
  scheduleId: number | null,
  segmentSourceItemId: number | null,
  destinationItemId: number | null,
  travelMode: ScheduleTravelModeValue | null,
  routeQueryEnabled = true,
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
    mutationFn: ({ roomId, scheduleId }: { roomId: string; scheduleId: number }) =>
      deleteRoomSchedule(roomId, scheduleId),
    onSuccess: async (_data, { roomId }) => {
      await invalidateExpenses(queryClient, roomId);
      const id = roomId.trim();
      if (!id.length) return;

      await refreshRoomSchedules(queryClient, id);
      await syncRoomDetailFromServer(queryClient, id);
    },
  });
}

export function useCreateRoomSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, body }: { roomId: string; body: RoomScheduleCreateRequest }) =>
      createRoomSchedule(roomId, body),
    onSuccess: async (_created, { roomId }) => {
      const id = roomId.trim();
      if (!id.length) return;
      await refreshRoomSchedules(queryClient, id);
      await syncRoomDetailFromServer(queryClient, id);
    },
  });
}

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
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      const previous = queryClient.getQueryData<RoomScheduleWithItems[]>(key);
      queryClient.setQueryData<RoomScheduleWithItems[]>(
        key,
        (old) => old && moveRoomScheduleToDay(old, scheduleId, targetDayNumber),
      );
      return { previous };
    },
    onError: (_error, { roomId }, context) => {
      queryClient.setQueryData(roomSchedulesQueryKey(roomId.trim()), context?.previous);
    },
    onSuccess: async (_data, { roomId }) => {
      const id = roomId.trim();
      if (!id.length) return;
      await invalidateExpenses(queryClient, id);
    },
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

const SCHEDULE_ITEM_MOVE_MUTATION_KEY = ["schedule-item-move"] as const;

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

function isLastItemMoveOf(queryClient: ReturnType<typeof useQueryClient>, roomId: string, scheduleId: number): boolean {
  const rid = roomId.trim();
  return (
    queryClient.isMutating({
      mutationKey: SCHEDULE_ITEM_MOVE_MUTATION_KEY,
      predicate: (mutation) => scheduleIdsOfItemMove(mutation.state.variables, rid).includes(scheduleId),
    }) <= 1
  );
}

export function useScheduleItemMoveSavingDays(roomId: string): number[] {
  const rid = roomId.trim();
  return useMutationState({
    filters: { mutationKey: SCHEDULE_ITEM_MOVE_MUTATION_KEY, status: "pending" },
    select: (mutation) => scheduleIdsOfItemMove(mutation.state.variables, rid),
  }).flat();
}

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
    onMutate: async ({ roomId, sourceScheduleId, itemId, targetScheduleId, targetOrderIndex }) => {
      const rid = roomId.trim();
      const sourceKey = scheduleItemsQueryKey(rid, sourceScheduleId);
      const targetKey = scheduleItemsQueryKey(rid, targetScheduleId);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: sourceKey, exact: true }),
        queryClient.cancelQueries({ queryKey: targetKey, exact: true }),
      ]);
      const previousSource = queryClient.getQueryData<PlanPlace[]>(sourceKey);
      const previousTarget = queryClient.getQueryData<PlanPlace[]>(targetKey);
      const moved = previousSource?.find((p) => p.itemId === itemId);
      if (moved) {
        queryClient.setQueryData<PlanPlace[]>(sourceKey, (old) => old && removePlanPlace(old, itemId));
        queryClient.setQueryData<PlanPlace[]>(targetKey, (old) => old && insertPlanPlace(old, moved, targetOrderIndex));
      }
      return { previousSource, previousTarget };
    },
    onError: (_error, { roomId, sourceScheduleId, targetScheduleId }, context) => {
      const rid = roomId.trim();
      queryClient.setQueryData(scheduleItemsQueryKey(rid, sourceScheduleId), context?.previousSource);
      queryClient.setQueryData(scheduleItemsQueryKey(rid, targetScheduleId), context?.previousTarget);
    },
    onSuccess: (_moved, { roomId }) => invalidateExpenses(queryClient, roomId),
    onSettled: (_moved, _error, { roomId, sourceScheduleId, targetScheduleId }) => {
      for (const scheduleId of [sourceScheduleId, targetScheduleId]) {
        if (isLastItemMoveOf(queryClient, roomId, scheduleId)) {
          void invalidateDayPlacesAfterOwnChange(queryClient, roomId, scheduleId);
        }
      }
    },
  });
}

export function useSchedulePlanPlaces(roomId: string | null, scheduleId: number | null) {
  const rid = roomId?.trim() ?? "";
  const sid = scheduleId;
  const queryClient = useQueryClient();
  const { isSuccess: schedulesHydrated } = useRoomSchedules(rid || null);

  return useQuery({
    ...schedulePlanPlacesQueryOptions(queryClient, rid, sid),
    enabled: rid.length > 0 && typeof sid === "number" && Number.isFinite(sid) && schedulesHydrated,
    refetchOnWindowFocus: false,
  });
}

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
      applyCreatedScheduleItemToPlanPlaces(queryClient, roomId, scheduleId, response),
    onSettled: (_response, _error, { roomId, scheduleId }) =>
      invalidateDayPlacesAfterOwnChange(queryClient, roomId, scheduleId),
  });
}

export function useUpdateScheduleItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { roomId: string; scheduleId: number; itemId: number; body: RoomScheduleItemUpdateRequest }) =>
      updateScheduleItem(vars.roomId, vars.scheduleId, vars.itemId, vars.body),
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

export function useUpdateScheduleItemTravelMode(roomId: string, scheduleId: number, itemId: number) {
  const queryClient = useQueryClient();
  const mutationKey = ["schedule-item-travel-mode", roomId, scheduleId, itemId] as const;
  return useMutation({
    mutationKey,
    // 이동수단은 출발 항목에 저장한다. 같은 항목의 PATCH만 선택 순서대로 보낸다.
    scope: { id: JSON.stringify(mutationKey) },
    mutationFn: (travelMode: ScheduleTravelModeValue) =>
      updateScheduleItemTravelMode(roomId, scheduleId, itemId, { travelMode }),
    onSuccess: (updated) => {
      queryClient.setQueryData<PlanPlace[]>(
        scheduleItemsQueryKey(roomId, scheduleId),
        (old) => applyRoomScheduleItemToPlanPlaces(old, updated) ?? old,
      );
    },
    onSettled: () => invalidateDayPlacesAfterOwnChange(queryClient, roomId, scheduleId),
  });
}

export function useDeleteScheduleItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { roomId: string; scheduleId: number; itemId: number }) =>
      deleteScheduleItem(vars.roomId, vars.scheduleId, vars.itemId),
    onSuccess: async (_, { roomId, scheduleId, itemId }) => {
      await invalidateExpenses(queryClient, roomId);
      removeScheduleItemFromPlanPlacesCache(queryClient, roomId, scheduleId, itemId);
    },
    onSettled: (_data, _error, { roomId, scheduleId }) =>
      invalidateDayPlacesAfterOwnChange(queryClient, roomId, scheduleId),
  });
}

export function useReorderScheduleItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: SCHEDULE_ITEM_MOVE_MUTATION_KEY,
    mutationFn: (vars: { roomId: string; scheduleId: number; itemId: number; body: ReorderScheduleItemRequest }) =>
      reorderScheduleItem(vars.roomId, vars.scheduleId, vars.itemId, vars.body),
    onMutate: async ({ roomId, scheduleId, itemId, body }) => {
      const key = scheduleItemsQueryKey(roomId.trim(), scheduleId);
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      const previous = queryClient.getQueryData<PlanPlace[]>(key);
      queryClient.setQueryData<PlanPlace[]>(
        key,
        (old) => old && movePlanPlaceWithinDay(old, itemId, body.newOrderIndex),
      );
      return { previous };
    },
    onError: (_error, { roomId, scheduleId }, context) => {
      queryClient.setQueryData(scheduleItemsQueryKey(roomId.trim(), scheduleId), context?.previous);
    },
    onSuccess: (items, { roomId }) => {
      trackAnalyticsEvent(AnalyticsEvents.reorderItinerary, {
        room_id: roomId,
        item_count_bucket: bucketItemCount(items.length),
        method: "drag_drop",
      });
    },
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
    }) =>
      trackRoomMutation(
        queryClient,
        roomId,
        AnalyticsEvents.roomInfoUpdated,
        () => updateRoom(roomId, data),
        (result) => result.role,
      ),
    retry: false,
    onSuccess: async (updated, { roomId, data, previousStartDate, previousEndDate }) => {
      queryClient.setQueryData<RoomListResponse>(ROOMS_QUERY_KEY, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          rooms: prev.rooms.map((r) =>
            r.id === roomId
              ? {
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
      queryClient.setQueryData<RoomDetail>(roomDetailQueryKey(roomId), (prev) =>
        prev && prev.id === roomId
          ? {
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
      trigger === "automatic"
        ? regenerateInviteCode(roomId)
        : trackRoomMutation(queryClient, roomId, AnalyticsEvents.inviteCodeIssued, () => regenerateInviteCode(roomId)),
    retry: false,
    onSuccess: (data, { roomId }) => {
      queryClient.setQueryData<RoomDetail>(roomDetailQueryKey(roomId), (prev) =>
        prev ? { ...prev, inviteCode: data.inviteCode } : prev,
      );
    },
  });
}

export function useRoomMembers(roomId: string | null) {
  const pathname = usePathname();
  const { data: user } = useSessionUser();
  const { connected: stompConnected } = useStompContext();

  const waitForStompBeforeMembers =
    Boolean(user && roomId) && !pathSuspendsStomp(pathname) && !pathDefersRoomStompRoomTopics(pathname);

  return useQuery({
    queryKey: roomMembersQueryKey(roomId),
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
      confirm(roomId, response.id === roomId && joinStatusForWaitingUi(response) === "APPROVED");
      return response;
    },
  });
}

export function useJoinRequests(roomId: string | null, options?: { enabled?: boolean }) {
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
    mutationFn: ({ roomId, targetUserId }: { roomId: string; targetUserId: number }) =>
      transferHost(roomId, targetUserId),
    onSuccess: (_, { roomId, targetUserId }) => {
      applyHostTransferToCache(queryClient, roomId, readSessionUserId(queryClient), targetUserId);
    },
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
    onSuccess: (_, roomId) => {
      evictRoomFromClientCaches(queryClient, roomId);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ROOMS_QUERY_KEY });
    },
  });
}

export function useKickMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, userId }: { roomId: string; userId: number }) => kickMember(roomId, userId),
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
    mutationFn: ({ roomId, requestId }: { roomId: string; requestId: number }) => approveJoinRequest(roomId, requestId),
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
    mutationFn: ({ roomId, requestId }: { roomId: string; requestId: number }) => rejectJoinRequest(roomId, requestId),
    onSettled: (_data, _error, { roomId }) => queryClient.invalidateQueries({ queryKey: joinRequestsQueryKey(roomId) }),
  });
}

export function useBookmarkCategories(roomId: string | null, options?: { enabled?: boolean }) {
  const queryEnabled = options?.enabled ?? true;
  return useQuery({
    queryKey: bookmarkCategoriesQueryKey(roomId),
    queryFn: () => getBookmarkCategories(roomId!),
    enabled: !!roomId && queryEnabled,
    staleTime: Infinity,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

export function useCreateBookmarkCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, name, colorCode }: { roomId: string; name: string; colorCode: string }) =>
      createBookmarkCategory(roomId, { name, colorCode }),
    onSuccess: (created, { roomId }) => {
      appendBookmarkCategoryToCache(queryClient, roomId, created);
    },
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
    onSuccess: (updated, { roomId, categoryId }) => {
      queryClient.setQueryData<BookmarkCategory[]>(bookmarkCategoriesQueryKey(roomId), (prev) =>
        prev?.map((c) =>
          c.categoryId === categoryId ? { ...c, name: updated.name, colorCode: updated.colorCode } : c,
        ),
      );
    },
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
    mutationFn: ({ roomId, categoryId }: { roomId: string; categoryId: number }) =>
      deleteBookmarkCategory(roomId, categoryId),
    onSettled: (_data, _error, { roomId }) => invalidateRoomBookmarkLists(queryClient, roomId),
  });
}

function roomBookmarksQueryOptions(roomId: string | null) {
  return queryOptions({
    queryKey: roomAllBookmarksQueryKey(roomId),
    queryFn: () => getAllRoomBookmarks(roomId!),
    staleTime: Infinity,
  });
}

export function useAllRoomBookmarks(roomId: string | null, options?: { enabled?: boolean }) {
  const queryEnabled = options?.enabled ?? true;
  return useQuery({
    ...roomBookmarksQueryOptions(roomId),
    enabled: !!roomId && queryEnabled,
  });
}

export function useRoomBookmarks(roomId: string | null, categoryId: number | null) {
  const idOk = categoryId != null && Number.isFinite(categoryId) && categoryId >= 0;
  return useQuery({
    ...roomBookmarksQueryOptions(idOk ? roomId : null),
    enabled: !!roomId && idOk,
    select: (bookmarks) => bookmarks.filter((b) => b.categoryId === categoryId),
  });
}

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
      queryClient.setQueryData<BookmarkCategory[]>(bookmarkCategoriesQueryKey(roomId), (prev) => {
        if (!prev?.length) return prev;
        return prev.map((c) => (bumped.has(c.categoryId) ? { ...c, placeCount: c.placeCount + 1 } : c));
      });
      appendRoomBookmarksToCache(queryClient, roomId, bookmarks);
    },
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
    onSuccess: (moved, { roomId }) => {
      queryClient.setQueryData<RoomBookmark[]>(roomAllBookmarksQueryKey(roomId), (prev) =>
        prev?.map((b) => (b.bookmarkId === moved.bookmarkId ? moved : b)),
      );
    },
    onSettled: (_moved, _error, { roomId }) => {
      void invalidateRoomBookmarkLists(queryClient, roomId);
    },
  });
}

export function useDeleteRoomBookmarkItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { roomId: string; bookmarkId: number; categoryId: number }) =>
      deleteRoomBookmark(input.roomId, input.bookmarkId),
    onSettled: (_data, _error, { roomId }) => invalidateRoomBookmarkLists(queryClient, roomId),
  });
}
